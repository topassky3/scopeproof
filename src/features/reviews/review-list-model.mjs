/**
 * Ported from Lopera's Next.js Reviews prototype into the main React/Vite UI.
 * Reuse the same list/filter/metrics behavior with the existing dashboard shell.
 */
export function buildReviewRows(selected, summary, indexed = []) {
  const byKey = new Map(indexed.map(item => [item.issueKey, item]));
  if (selected && summary) byKey.set(selected.issueKey, {
    issueKey: selected.issueKey,
    summary: selected.summary,
    status: summary.status,
    covered: summary.covered,
    mandatory: summary.mandatory,
  });
  return [...byKey.values()].sort((a, b) => a.issueKey.localeCompare(b.issueKey));
}

export function filterReviewRows(rows, search = '', status = 'all') {
  const term = search.trim().toLowerCase();
  return rows.filter(item =>
    (status === 'all' || item.status === status)
    && (!term || item.issueKey.toLowerCase().includes(term)
      || item.summary.toLowerCase().includes(term))
  );
}

export function reviewMetrics(rows) {
  return {
    reviews: rows.length,
    approved: rows.filter(item => item.status === 'approved').length,
    revalidation: rows.filter(item => item.status === 'revalidation').length,
    notFinalized: rows.filter(item => ['pending', 'ready', 'in-review'].includes(item.status)).length,
  };
}
