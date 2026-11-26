const id = value => typeof value === 'string' && value.trim().length > 0;
const version = value => Number.isSafeInteger(value) && value > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// A reference is not fetched; require a syntactically valid HTTPS URL with a host.
export function validEvidenceUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\/[^/?#]/i.test(value) || /[\s\\]/u.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch { return false; }
}

// Validate stored records before making trusted projections or mutations.
// Historical decision-to-event ambiguity remains a read-only presentation concern.
export function inspectReviewRecords(review) {
  if (!record(review) || !Number.isSafeInteger(review.revision) || review.revision < 0 ||
      !['requirements', 'evidence', 'approvals', 'events'].every(k => Array.isArray(review[k]))) {
    return ['INVALID_REVIEW_STRUCTURE'];
  }
  const problems = new Set();
  const requirements = new Map();
  for (const r of review.requirements) {
    if (!record(r) || !id(r.id) || !version(r.version) || typeof r.mandatory !== 'boolean' || !Array.isArray(r.versions)) {
      problems.add('INVALID_REQUIREMENT'); continue;
    }
    if (requirements.has(r.id)) problems.add('AMBIGUOUS_REQUIREMENT_ID');
    requirements.set(r.id, r);
    const seenVersions = new Set();
    for (const v of r.versions) {
      if (!record(v) || !version(v.version) || v.version > r.version || !id(v.title) || seenVersions.has(v.version)) {
        problems.add('INVALID_REQUIREMENT_VERSION'); continue;
      }
      seenVersions.add(v.version);
      if (v.version === r.version && v.title !== r.title) problems.add('INVALID_REQUIREMENT_VERSION');
    }
  }
  const evidence = new Map();
  for (const e of review.evidence) {
    if (!record(e) || !id(e.id) || !id(e.requirementId) || !version(e.version) || !['passed', 'failed'].includes(e.result) ||
        (e.url != null && e.url !== '' && !validEvidenceUrl(e.url))) {
      problems.add('INVALID_EVIDENCE'); continue;
    }
    if (evidence.has(e.id)) problems.add('AMBIGUOUS_EVIDENCE_ID');
    evidence.set(e.id, e);
    const r = requirements.get(e.requirementId);
    if (!r || e.version > r.version) problems.add('INVALID_EVIDENCE_REFERENCE');
  }
  for (const event of review.events) {
    if (!record(event) || !id(event.id) || typeof event.description !== 'string' ||
        (event.type !== undefined && typeof event.type !== 'string')) problems.add('INVALID_AUDIT_EVENT');
  }
  for (const [index, latest] of review.approvals.entries()) {
    if (!record(latest) || !['approved', 'rejected'].includes(latest.type)) {
      problems.add(index === review.approvals.length - 1 ? 'INVALID_LATEST_DECISION' : 'INVALID_HISTORICAL_DECISION');
      continue;
    }
    if (latest.type === 'rejected') {
      if (!Array.isArray(latest.snapshot) || latest.snapshot.length !== 0) problems.add('INVALID_REJECTION_SNAPSHOT');
      continue;
    }
    const seen = new Set();
    if (!Array.isArray(latest.snapshot) || !latest.snapshot.length) problems.add('SNAPSHOT_INVALID');
    else for (const s of latest.snapshot) {
      if (!record(s) || !id(s.requirementId) || !id(s.evidenceId) || !version(s.version) || seen.has(s.requirementId)) {
        problems.add('SNAPSHOT_INVALID'); continue;
      }
      seen.add(s.requirementId);
      const r = requirements.get(s.requirementId), e = evidence.get(s.evidenceId);
      if (!r?.mandatory || s.version > r.version) problems.add('SNAPSHOT_SCOPE_OR_VERSION_INCONSISTENT');
      if (!e || e.requirementId !== s.requirementId || e.version !== s.version || e.result !== 'passed') {
        problems.add('SNAPSHOT_EVIDENCE_UNVERIFIED');
      }
    }
  }
  return [...problems];
}
