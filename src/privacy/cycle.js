import { actorInventory, isAccountId, redactActorReferences } from './review-data.js';

const sources = ['ces', 'legacy'];
const validKey = key => typeof key === 'string' && /^review:[0-9]+$/.test(key);
export async function inventoryStorage(io, { maxPages = 200, maxRecords = 10000 } = {}) {
  const accounts = new Map(), records = [];
  for (const source of sources) {
    let cursor;
    const cursors = new Set(), keys = new Set();
    for (let pageNo = 0; ; pageNo++) {
      if (pageNo >= maxPages) throw Error('PRIVACY_PAGE_BUDGET');
      const page = await io.listPage(source, cursor);
      if (!Array.isArray(page?.keys)) throw Error('PRIVACY_INVALID_PAGE');
      for (const key of page.keys) {
        if (!validKey(key)) throw Error('PRIVACY_UNCLASSIFIED_KEY');
        if (keys.has(key)) continue;
        keys.add(key);
        if (records.length >= maxRecords) throw Error('PRIVACY_RECORD_BUDGET');
        const record = await io.read(source, key);
        if (record == null) continue;
        const review = record.review;
        if (!review || key !== 'review:' + review.issueId) throw Error('PRIVACY_IDENTITY_MISMATCH');
        for (const [id, age] of actorInventory(review)) {
          if (!accounts.has(id) || age < accounts.get(id)) accounts.set(id, age);
        }
        records.push({ source, key });
      }
      if (page.nextCursor === undefined || page.nextCursor === null) break;
      if (typeof page.nextCursor !== 'string' || !page.nextCursor || cursors.has(page.nextCursor)) {
        throw Error('PRIVACY_CURSOR_INVALID');
      }
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
  }
  return { accounts: [...accounts].sort(([a],[b]) => a.localeCompare(b)).map(([accountId, updatedAt]) => ({accountId, updatedAt})), records };
}
// No network or storage writes except the explicitly injected reporting API.
// A caller must arrange durable reporting/checkpointing before real use.
export async function reportInventory(accounts, report) {
  const unique = new Set();
  for (const row of accounts) {
    if (!isAccountId(row.accountId) || unique.has(row.accountId) ||
        typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))) throw Error('PRIVACY_INVALID_REPORT');
    unique.add(row.accountId);
  }
  const actions = [];
  for (let start=0; start<accounts.length; start+=90) {
    const batch=accounts.slice(start,start+90);
    const allowed=new Set(batch.map(row=>row.accountId));
    const result=await report(batch);
    if (!Array.isArray(result)) throw Error('PRIVACY_INVALID_REPORT_RESPONSE');
    const seen=new Set();
    for (const action of result) {
      if (!allowed.has(action?.accountId) || seen.has(action.accountId) ||
          !['closed','updated'].includes(action.status)) throw Error('PRIVACY_INVALID_REPORT_RESPONSE');
      seen.add(action.accountId);
      actions.push({accountId:action.accountId,status:action.status});
    }
  }
  return actions;
}
// Candidate executor for synthetic integration tests and a future verified
// maintenance adapter. No resolver, web trigger or scheduled job calls this.
// Caller must provide authorized, exclusive maintenance and atomic CAS for BOTH
// stores. Legacy KVS does not currently provide a verified CAS implementation.
export async function applyClosedAccounts(io, actions, records) {
  if (io.exclusiveMaintenance !== true || typeof io.replaceIfRevision !== 'function') throw Error('PRIVACY_MAINTENANCE_REQUIRED');
  if (!Array.isArray(actions) || actions.some(a=>!isAccountId(a?.accountId)||!['closed','updated'].includes(a.status))) throw Error('PRIVACY_INVALID_ACTION');
  if (new Set(actions.map(a=>a.accountId)).size!==actions.length) throw Error('PRIVACY_DUPLICATE_ACTION');
  const ids=actions.filter(a=>a.status==='closed').map(a=>a.accountId);
  let changed=0, removed=0;
  for (const {source,key} of records) {
    if (!sources.includes(source)||!validKey(key)) throw Error('PRIVACY_INVALID_RECORD');
    const current=await io.read(source,key);
    if (current==null) continue;
    if ('review:'+current.review?.issueId!==key) throw Error('PRIVACY_IDENTITY_MISMATCH');
    const next=redactActorReferences(current.review,ids);
    if (!next.removed) continue;
    // Never overwrite a competing write or retry blindly.
    const ok=await io.replaceIfRevision(source,key,current,next.review);
    if (ok!==true) throw Error('PRIVACY_WRITE_CONFLICT');
    changed++;
    removed+=next.removed;
  }
  return { changed, removed, updatesRequiringReview:actions.filter(a=>a.status==='updated').length };
}
