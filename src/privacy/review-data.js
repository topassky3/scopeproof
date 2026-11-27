import { randomUUID } from 'node:crypto';
import { eventDetail } from '../features/history/history-model.mjs';
import { inspectReviewRecords } from '../review-integrity.js';
import { readReviewForUse } from '../review-read.js';

export const ERASED_ACTOR = 'privacy-erased';
const excluded = new Set(['unknown', 'demo', 'local-preview', ERASED_ACTOR]);
const accountPattern = /^[A-Za-z0-9:-]{1,128}$/;
const isErased = value => value === ERASED_ACTOR || (typeof value==='string' && /^privacy-erased\/[a-f0-9-]{36}$/.test(value));
export function isAccountId(value) {
  return typeof value === 'string' && accountPattern.test(value) && !excluded.has(value);
}
function slots(review) {
  if (!readReviewForUse(review).ok) throw Error('PRIVACY_INVALID_REVIEW');
  return [...review.events, ...review.evidence, ...review.approvals,
    ...review.requirements.flatMap(r => r.versions)];
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      || !Number.isFinite(Date.parse(value))) throw Error('PRIVACY_UNKNOWN_DATA_AGE');
  return new Date(value).toISOString();
}
export function actorInventory(review) {
  const accounts = new Map();
  for (const item of slots(review)) {
    const id = item.actor;
    if (id == null || id === '' || excluded.has(id) || isErased(id)) continue;
    if (!isAccountId(id)) throw Error('PRIVACY_UNCLASSIFIED_ACTOR');
    const at = date(item.createdAt);
    if (!accounts.has(id) || at < accounts.get(id)) accounts.set(id, at);
  }
  return accounts;
}
// Preserve decision snapshots, evidence and versions. Remove attribution, not
// the business event. Never derive the replacement from the account ID.
export function redactActorReferences(review, accountIds) {
  slots(review);
  const ids = new Set(accountIds);
  if ([...ids].some(id => !isAccountId(id))) throw Error('PRIVACY_INVALID_TARGET');
  const next = structuredClone(review);
  const targets = slots(next).filter(item=>ids.has(item.actor));
  const pairs = [], counts = new Map(), labels = new Map();
  // Resolve only links already proven by the original history projection.
  // An opaque marker is unique per event/record pair, never per person.
  for (const event of next.events) {
    if (!ids.has(event.actor)) continue;
    const detail=eventDetail(next,event);
    let candidates=[];
    if (detail.kind==='decision') {
      const type=event.type==='review-approved'?'approved':'rejected';
      candidates=next.approvals.filter(r=>r.type===type);
    } else if (detail.kind==='requirement') {
      candidates=next.requirements.find(r=>r.id===detail.requirementId)?.versions.filter(v=>v.version===detail.version)??[];
    } else if (detail.kind==='evidence') {
      candidates=next.evidence.filter(r=>r.id===detail.evidenceId);
    }
    candidates=candidates.filter(r=>r.actor===event.actor&&r.createdAt===event.createdAt);
    if (candidates.length!==1) continue;
    const record=candidates[0];
    pairs.push([event,record]);counts.set(record,(counts.get(record)??0)+1);
  }
  for (const [event,record] of pairs) if(counts.get(record)===1) {
    const marker=ERASED_ACTOR+'/'+randomUUID();
    labels.set(event,marker);labels.set(record,marker);
  }
  for (const item of targets) item.actor=labels.get(item)??ERASED_ACTOR;
  const removed=targets.length;
  if (!removed) return { review, removed: 0 };
  if (next.revision === Number.MAX_SAFE_INTEGER) throw Error('PRIVACY_REVISION_CAPACITY');
  next.revision++;
  if (inspectReviewRecords(next).length || !readReviewForUse(next).ok) throw Error('PRIVACY_INVALID_REDACTION');
  return { review: next, removed };
}
