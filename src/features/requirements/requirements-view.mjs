/**
 * Read-only projection for Requirements. The authoritative mutations stay in
 * src/domain.js and the existing App editor, not in this UI helper.
 */
export function evidenceOverview(row, evidence = []) {
  const records = evidence.filter(item => item.requirementId === row.id);
  const current = records.filter(item => item.version === row.version).at(-1) ?? null;
  const previousCount = records.filter(item => item.version < row.version).length;
  let label = 'Missing';
  if (row.state === 'satisfied') label = 'Current';
  else if (row.state === 'failed') label = 'Failed';
  else if (row.state === 'stale') label = 'Outdated';
  const description = label === 'Current'
    ? 'The most recent evidence for this version passed.'
    : label === 'Failed'
      ? 'The latest test for this version failed. A new passing result is needed.'
      : label === 'Outdated'
        ? 'Evidence from an earlier version is preserved but does not cover this version.'
        : 'This version has no recorded evidence yet.';
  return { label, current, previousCount, description };
}

export function requirementMetrics(summary) {
  const rows = summary?.rows ?? [];
  return {
    total: rows.length,
    mandatory: rows.filter(item => item.mandatory).length,
    optional: rows.filter(item => !item.mandatory).length,
    covered: summary?.covered ?? 0,
    attention: rows.filter(item => item.mandatory && item.state !== 'satisfied').length,
  };
}

export function findRequirements(rows, search = '', state = 'all') {
  const term = search.trim().toLowerCase();
  return rows.filter(item => {
    const matchesText = !term || item.id.toLowerCase().includes(term)
      || item.title.toLowerCase().includes(term);
    const matchesState = state === 'all'
      || (state === 'attention' && item.mandatory && item.state !== 'satisfied')
      || item.state === state;
    return matchesText && matchesState;
  });
}
