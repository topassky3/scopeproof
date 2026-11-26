// Advisory only. No writes, automatic decisions, or invented passing results.
import { analyzeReviewImpact } from './change-impact.js';

import { inspectReviewRecords } from './review-integrity.js';

export function analyzeAndPlanReview(review) {
  const base = { revision: Number.isSafeInteger(review?.revision) ? review.revision : null,
    status: null, disposition: 'inspect-records', minimumActions: null, actions: [],
    retainedEvidence: [], issues: [] };
  const issues = inspectReviewRecords(review);
  if (issues.length) return { impact: null, plan: { ...base, issues } };
  const impact = analyzeReviewImpact(review);
  const plan = planFromImpact(review, base, impact);
  return { impact: plan.disposition === 'inspect-records' ? null : impact, plan };
}

export function planRevalidation(review) {
  return analyzeAndPlanReview(review).plan;
}

// Only the validated path above can supply an impact to this private helper.
function planFromImpact(review, base, impact) {
  const state = { ...base, status: impact.status };
  // A rejection is a human decision, not a coverage problem to bypass.
  if (impact.status === 'rejected') return { ...state, disposition: 'human-review' };
  if (!impact.mandatory) return { ...state, disposition: 'define-mandatory-scope' };
  const retainedEvidence = impact.requirements.filter(r => r.state === 'satisfied').map(r => ({
    requirementId: r.requirementId, version: r.version, evidenceId: r.evidenceId,
    snapshotRelation: r.snapshotRelation,
  }));
  if (impact.status === 'approved') return { ...state, disposition: 'no-action', minimumActions: 0, retainedEvidence };
  const blocked = impact.requirements.filter(r => r.state !== 'satisfied');
  // Current addEvidence generates identifiers from the array length.
  // Do not promise a valid recovery if that allocation would collide.
  const existingIds = new Set(review.evidence.map(e => e.id));
  for (let i = 0; i < blocked.length; i++) {
    if (existingIds.has(`EV-${review.evidence.length + 101 + i}`)) {
      return { ...state, issues: ['EVIDENCE_ID_ALLOCATION_COLLISION'] };
    }
  }
  if (review.revision > Number.MAX_SAFE_INTEGER - (blocked.length + 1)) {
    return { ...state, issues: ['REVISION_CAPACITY_EXCEEDED'] };
  }
  const actions = blocked.map(r => ({ type: 'obtain-passing-evidence', requirementId: r.requirementId,
    version: r.version, reasons: [...r.reasons] }));
  actions.push({ type: 'request-explicit-approval' });
  return { ...state, disposition: impact.activeRevalidation ? 'revalidate' : 'initial-approval',
    minimumActions: actions.length, actions, retainedEvidence };
}
