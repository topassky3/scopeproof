// Read-only causal projection. summarize remains authoritative for approval.
import { summarize } from './domain.js';

const nonempty = value => typeof value === 'string' && value.length > 0;

// A malformed snapshot cannot establish per-requirement historical facts.
function indexSnapshot(snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  const entries = new Map();
  for (const entry of snapshot) {
    if (!entry || !nonempty(entry.requirementId) || !nonempty(entry.evidenceId) ||
        !Number.isInteger(entry.version) || entry.version < 1 || entries.has(entry.requirementId)) return null;
    entries.set(entry.requirementId, entry);
  }
  return entries;
}

export function analyzeReviewImpact(review) {
  const summary = summarize(review);
  const mandatoryRows = summary.rows.filter(row => row.mandatory);
  const mandatoryIds = new Set(mandatoryRows.map(row => row.id));
  const hasApproval = summary.latestApproval?.type === 'approved';
  const activeRevalidation = summary.status === 'revalidation';
  const reviewReasons = [];
  const uniqueMandatoryIds = mandatoryIds.size === mandatoryRows.length;
  if (!mandatoryRows.length) reviewReasons.push('NO_MANDATORY_REQUIREMENTS');
  if (!uniqueMandatoryIds) reviewReasons.push('MANDATORY_IDS_AMBIGUOUS');
  const indexedSnapshot = hasApproval ? indexSnapshot(summary.latestApproval.snapshot) : null;
  if (hasApproval && !indexedSnapshot) reviewReasons.push('SNAPSHOT_INVALID');
  const snapshot = uniqueMandatoryIds ? indexedSnapshot : null;
  const evidenceById = new Map();
  for (const evidence of review.evidence ?? []) {
    evidenceById.set(evidence.id, evidenceById.has(evidence.id) ? null : evidence);
  }
  // Missing membership is observable; it does not prove when scope was added.
  if (snapshot && [...snapshot.keys()].some(id => !mandatoryIds.has(id))) {
    reviewReasons.push('SNAPSHOT_SCOPE_MISMATCH');
  }
  const requirements = mandatoryRows.map(row => {
    const entry = snapshot?.get(row.id);
    const evidenceId = row.latestEvidence?.id ?? null;
    const reasons = [];
    let snapshotRelation = hasApproval ? 'unavailable' : 'not-applicable';
    if (snapshot) {
      if (!entry) {
        snapshotRelation = 'not-captured';
        reasons.push('MANDATORY_SCOPE_NOT_IN_SNAPSHOT');
      } else if (entry.version !== row.version) {
        snapshotRelation = 'version-changed';
        reasons.push('REQUIREMENT_VERSION_CHANGED');
      } else if (entry.evidenceId !== evidenceId) {
        snapshotRelation = 'evidence-changed';
        if (evidenceId !== null) {
          const prior = evidenceById.get(entry.evidenceId);
          if (prior && prior.requirementId === row.id && prior.version === entry.version && prior.result === 'passed') {
            reasons.push('EVIDENCE_SUPERSEDED');
          } else {
            reasons.push('SNAPSHOT_EVIDENCE_UNVERIFIED');
          }
        }
      } else {
        snapshotRelation = 'matching';
      }
    }
    if (row.state === 'missing' || row.state === 'stale') reasons.push('EVIDENCE_MISSING');
    else if (row.state === 'failed') reasons.push('EVIDENCE_FAILED');
    return {
      requirementId: row.id,
      version: row.version,
      evidenceId,
      state: row.state,
      snapshotRelation,
      previousVersion: entry?.version ?? null,
      previousEvidenceId: entry?.evidenceId ?? null,
      reasons,
    };
  });
  if (activeRevalidation && summary.mandatory > 0 && summary.covered === summary.mandatory) {
    reviewReasons.push('FRESH_APPROVAL_REQUIRED');
  }
  return {
    status: summary.status,
    activeRevalidation,
    mandatory: summary.mandatory,
    covered: summary.covered,
    coveragePercent: summary.mandatory > 0 ? summary.covered / summary.mandatory * 100 : null,
    optionalCount: summary.rows.length - summary.mandatory,
    reviewReasons,
    requirements,
  };
}
