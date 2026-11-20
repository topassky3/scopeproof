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
    // Use the title attached to the EVIDENCE VERSION, not the current requirement title.
    const versionRecord = requirement?.versions?.find(v => v.version === entry.version);
    const historicalTitle = versionRecord?.title
      ?? (requirement?.version === entry.version ? requirement.title : null);
    return {
      ...entry,
      requirementTitle: historicalTitle ?? (requirement ? 'Historical description unavailable' : 'Requirement unavailable'),
      currentRequirementTitle: requirement?.title ?? null,
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
