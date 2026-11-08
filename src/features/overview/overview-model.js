/**
 * View-only helpers. The authoritative approval and evidence rules remain in domain.js.
 * Never fabricate Jira workflow statuses, assignees, or additional review records.
 */
export function buildReviewRows(review, summary, list = []) {
  const selected = {
    issueKey: review.issueKey,
    summary: review.summary,
    status: summary.status,
    covered: summary.covered,
    mandatory: summary.mandatory,
  };
  const seen = new Map();
  for (const item of list) {
    if (item && typeof item.issueKey === 'string' && item.issueKey.trim()) {
      seen.set(item.issueKey, item);
    }
  }
  // The opened review reflects the latest confirmed local/Forge state.
  seen.set(selected.issueKey, selected);
  return [...seen.values()];
}

export function filterReviewRows(rows, query = '', filter = 'all') {
  const needle = String(query).toLocaleLowerCase().trim();
  return rows.filter(row => {
    const matchesSearch = !needle || `${row.issueKey} ${row.summary}`.toLocaleLowerCase().includes(needle);
    const matchesStatus = filter === 'all' || (filter === 'in-review'
      ? ['in-review', 'ready'].includes(row.status)
      : row.status === filter);
    return matchesSearch && matchesStatus;
  });
}

export function overviewMetrics(rows) {
  const count = state => rows.filter(row => row.status === state).length;
  return {
    total: rows.length,
    approved: count('approved'),
    revalidation: count('revalidation'),
    inReview: count('in-review') + count('ready'),
    pending: count('pending'),
    rejected: count('rejected'),
  };
}

export function reviewImpact(review, summary) {
  const staleRows = summary.rows.filter(row => row.state === 'stale');
  const staleIds = new Set(staleRows.map(row => row.id));
  const outdatedEvidence = (review.evidence ?? []).filter(item => staleIds.has(item.requirementId)
    && item.version < (summary.rows.find(row => row.id === item.requirementId)?.version ?? 0));
  const historicalApproval = (review.approvals ?? []).some(item => item.type === 'approved');
  return {
    staleRequirements: staleRows.length,
    outdatedEvidence: outdatedEvidence.length,
    approvalsToRevalidate: summary.status === 'revalidation' && historicalApproval ? 1 : 0,
    affected: staleRows[0] ?? null,
  };
}

export function recentReviewActivity(review, limit = 3) {
  return (review.events ?? []).slice(-limit).reverse();
}
