/** Read-only review projections; mutation and approval validation stay in src/domain.js. */
export function latestReviewDecision(review) {
  const decisions = Array.isArray(review?.approvals) ? review.approvals : [];
  const latest = decisions.at(-1);
  if (!latest || !['approved', 'rejected'].includes(latest.type)) return null;
  return {
    type: latest.type,
    actor: typeof latest.actor === 'string' ? latest.actor : '',
    createdAt: typeof latest.createdAt === 'string' ? latest.createdAt : '',
    note: typeof latest.note === 'string' ? latest.note : '',
    snapshotCount: Array.isArray(latest.snapshot) ? latest.snapshot.length : 0,
  };
}

export function reviewActionMessage(summary) {
  if (summary.status === 'revalidation') return 'Previous approval needs a new decision. Current passing evidence does not automatically reapprove it.';
  if (summary.blockers?.length) return summary.blockers.length + ' mandatory requirement(s) need passing evidence for the latest version.';
  if (!summary.mandatory) return 'Add at least one mandatory requirement and passing evidence before approval.';
  if (summary.status === 'approved') return 'The latest decision applies to the current evidence snapshot.';
  if (summary.status === 'rejected') return 'The latest recorded decision rejected this review. See the decision details.';
  return 'Coverage is complete. An authorized reviewer must explicitly approve or reject.';
}
