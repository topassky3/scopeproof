// Atomicity is provided by CES conditional operations, not an in-process lock.
import { randomUUID } from 'node:crypto';
import { blankReview, applyCommand } from './domain.js';
import { requireReviewForUse, storedReviewRow } from './review-read.js';
import { sameRecordValue } from './shared/record-equality.js';
export const MAX_REVIEW_BYTES = 220 * 1024;
const absent = value => value === undefined || value === null;
const key = issue => `review:${issue.id}`;
const validKey = k => typeof k === 'string' && /^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(k);
const inspectionRow = issue => storedReviewRow(null, issue);
function checked(record, issue) {
  if (record.projectId !== String(issue.projectId) || record.issueKey !== issue.key ||
      record.revision !== String(record.review?.revision) || typeof record.token !== 'string' || !record.token) {
    throw Error('REVIEW_INSPECTION_REQUIRED');
  }
  return requireReviewForUse(record.review, issue);
}
export function createReviewStore(io) {
  async function load(issue) {
    const record = await io.get(key(issue));
    if (!absent(record)) {
      return { record, review: record.review, derived: checked(record, issue), exists: true };
    }
    const legacy = await io.legacyGet(key(issue));
    const review = absent(legacy) ? blankReview(issue) : legacy;
    return { record: null, review, derived: requireReviewForUse(review, issue), exists: !absent(legacy) };
  }
  async function getReview(issue) {
    const { review, derived } = await load(issue);
    return { review, derived };
  }
  async function command(issue, command, actor) {
    const old = await load(issue);
    const updated = applyCommand(old.review, command, actor);
    // Compare canonical JSON values: storage uses JSON serialization.
    const value = JSON.parse(JSON.stringify({projectId:String(issue.projectId), issueKey:issue.key,
      revision:String(updated.revision), token:randomUUID(), review:updated}));
    const derived = requireReviewForUse(value.review, issue);
    if (Buffer.byteLength(JSON.stringify(value),'utf8') > MAX_REVIEW_BYTES) throw Error('REVIEW_STORAGE_BUDGET_EXCEEDED');
    try {
      if (old.record) await io.replaceIfRevision(key(issue), old.record.revision, value);
      else await io.createIfAbsent(key(issue), value);
    } catch (error) {
      // Do not guess SDK error codes or automatically retry a write.
      // A unique exact receipt is sufficient to confirm our own commit.
      let observed;
      try { observed = await io.get(key(issue)); } catch { /* outcome unknown */ }
      if (observed?.token === value.token && sameRecordValue(observed,value)) return {review:value.review, derived};
      throw Error('COMMIT_OUTCOME_UNKNOWN: Reload before any retry.');
    }
    return {review:value.review, derived};
  }
  async function row(issue) {
    try {
      const loaded = await load(issue);
      return loaded.exists ? storedReviewRow(loaded.review, issue) : null;
    } catch (error) {
      if (error?.message === 'REVIEW_INSPECTION_REQUIRED') return inspectionRow(issue);
      throw error;
    }
  }
  // Keep legacy index read-only. A CES query is eventually consistent; use
  // it only to discover candidates, and authorize + directly read each issue.
  // Bound work to the existing 40-issue project view, not full pagination.
  async function candidateKeys(projectId) {
    const legacy = await io.legacyIndex(projectId);
    if (!absent(legacy) && !Array.isArray(legacy)) throw Error('INVALID_LEGACY_INDEX');
    const old = (legacy ?? []).filter(validKey).slice(0,200);
    const current = new Set(), seenCursors = new Set();
    let cursor;
    for (let page=0; page<5; page++) {
      const result = await io.listPage(projectId,cursor);
      result.keys.filter(validKey).forEach(k=>current.add(k));
      cursor = result.nextCursor;
      if (!cursor) break;
      if (seenCursors.has(cursor)) throw Error('INVALID_CES_CURSOR');
      seenCursors.add(cursor);
    }
    // Interleave sources so that an older index cannot starve all new entries.
    const fresh = [...current], merged = new Set();
    for(let i=0;i<Math.max(fresh.length,old.length) && merged.size<40;i++) {
      if(fresh[i]) merged.add(fresh[i]);
      if(old[i] && merged.size<40) merged.add(old[i]);
    }
    return [...merged];
  }
  return {getReview,command,row,candidateKeys};
}
