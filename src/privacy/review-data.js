import { inspectReviewRecords } from '../review-integrity.js';
import { readReviewForUse } from '../review-read.js';

export const ERASED_ACTOR = 'privacy-erased';
const excluded = new Set(['unknown', 'demo', 'local-preview', ERASED_ACTOR]);
const accountPattern = /^[A-Za-z0-9:-]{1,128}$/;
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
    if (id == null || id === '' || excluded.has(id)) continue;
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
  let removed = 0;
  for (const item of slots(next)) if (ids.has(item.actor)) {
    item.actor = ERASED_ACTOR;
    removed++;
  }
  if (!removed) return { review, removed: 0 };
  if (next.revision === Number.MAX_SAFE_INTEGER) throw Error('PRIVACY_REVISION_CAPACITY');
  next.revision++;
  if (inspectReviewRecords(next).length || !readReviewForUse(next).ok) throw Error('PRIVACY_INVALID_REDACTION');
  return { review: next, removed };
}
