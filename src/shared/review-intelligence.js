// Shared read-only projection for the Forge review and its exports.
// Keep the domain, diagnosis and planning rules in their existing modules.
import { analyzeReviewImpact } from '../change-impact.js';
import { planRevalidation } from '../revalidation-planner.js';
import { sameRecordValue } from './record-equality.js';

// Private provenance is never serialized into the JSON or PDF contract.
// The detached copies also detect in-place mutations after projection.
/** @type {WeakMap<object, {review: unknown, projection: unknown}>} */
const origins = new WeakMap();

/** @param {unknown} intelligence @param {unknown} review */
export function matchesReviewSource(intelligence, review) {
  if (!intelligence || typeof intelligence !== 'object') return false;
  try {
    const origin = origins.get(intelligence);
    return Boolean(origin && sameRecordValue(origin.review, review) &&
      sameRecordValue(origin.projection, intelligence));
  } catch { return false; }
}

export function buildReviewIntelligence(review) {
  const plan = planRevalidation(review);
  // A domain status by itself is not a trustworthy presentation when the
  // planner has rejected the records or cannot safely allocate evidence IDs.
  if (plan.disposition === 'inspect-records') {
    return { kind: 'unavailable', revision: plan.revision, impact: null, plan };
  }
  const projection = { kind: 'available', revision: plan.revision,
    impact: analyzeReviewImpact(review), plan };
  try {
    origins.set(projection, {review: structuredClone(review), projection: structuredClone(projection)});
  } catch { /* Unsupported data has no publishable provenance. */ }
  return projection;
}
