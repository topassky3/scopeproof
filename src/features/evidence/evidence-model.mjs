// Pure view helpers. Business decisions remain authoritative in src/domain.js.
const identity = (evidence) => String(evidence.requirementId) + '::' + String(evidence.version);

export function buildEvidenceRows(review) {
  const records = review?.evidence ?? [];
  const requirements = new Map((review?.requirements ?? []).map(item => [item.id, item]));
  const latestPositions = new Map();
  records.forEach((entry, index) => latestPositions.set(identity(entry), index));
  return records.map((entry, index) => {
    const requirement = requirements.get(entry.requirementId);
    const applicability = !requirement ? 'unknown'
      : entry.version < requirement.version ? 'outdated'
      : entry.version > requirement.version ? 'unknown'
      : latestPositions.get(identity(entry)) === index ? 'current' : 'superseded';
    return {
      ...entry,
      requirementTitle: requirement?.title ?? 'Requirement unavailable',
      mandatory: Boolean(requirement?.mandatory),
      currentVersion: requirement?.version ?? null,
      applicability,
    };
  }).reverse();
}

export function evidenceMetrics(rows) {
  return {
    total: rows.length,
    current: rows.filter(row => row.applicability === 'current').length,
    outdated: rows.filter(row => row.applicability === 'outdated').length,
    failedCurrent: rows.filter(row => row.applicability === 'current' && row.result === 'failed').length,
  };
}

export function filterEvidenceRows(rows, query = '', applicability = 'all', result = 'all') {
  const needle = String(query).trim().toLowerCase();
  return rows.filter(row => {
    if (applicability !== 'all' && row.applicability !== applicability) return false;
    if (result !== 'all' && row.result !== result) return false;
    if (!needle) return true;
    return [row.id, row.title, row.requirementId, row.requirementTitle]
      .some(value => String(value ?? '').toLowerCase().includes(needle));
  });
}
