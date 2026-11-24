// Shared read-only projection for the Forge review and its exports.
// Keep the domain, diagnosis and planning rules in their existing modules.
import { analyzeReviewImpact } from '../change-impact.js';
import { planRevalidation } from '../revalidation-planner.js';

export function buildReviewIntelligence(review) {
  const plan = planRevalidation(review);
  // A domain status by itself is not a trustworthy presentation when the
  // planner has rejected the records or cannot safely allocate evidence IDs.
  if (plan.disposition === 'inspect-records') {
    return { kind: 'unavailable', revision: plan.revision, impact: null, plan };
  }
  return { kind: 'available', revision: plan.revision,
    impact: analyzeReviewImpact(review), plan };
}
