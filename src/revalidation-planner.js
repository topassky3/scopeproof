// Advisory only. No writes, automatic decisions, or invented passing results.
import { analyzeReviewImpact } from './change-impact.js';

const id = value => typeof value === 'string' && value.trim().length > 0;
const version = value => Number.isSafeInteger(value) && value > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Check the current planning inputs before deriving any executable advice.
// This is not a complete audit of historical records or authorization.
function integrity(review) {
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
  }
  const evidence = new Map();
  for (const e of review.evidence) {
    if (!record(e) || !id(e.id) || !id(e.requirementId) || !version(e.version) || !['passed', 'failed'].includes(e.result)) {
      problems.add('INVALID_EVIDENCE'); continue;
    }
    if (evidence.has(e.id)) problems.add('AMBIGUOUS_EVIDENCE_ID');
    evidence.set(e.id, e);
    const r = requirements.get(e.requirementId);
    if (!r || e.version > r.version) problems.add('INVALID_EVIDENCE_REFERENCE');
  }
  const latest = review.approvals.at(-1);
  if (review.approvals.length && (!record(latest) || !['approved', 'rejected'].includes(latest.type))) {
    problems.add('INVALID_LATEST_DECISION');
  } else if (latest?.type === 'approved') {
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

export function planRevalidation(review) {
  const base = { revision: Number.isSafeInteger(review?.revision) ? review.revision : null,
    status: null, disposition: 'inspect-records', minimumActions: null, actions: [],
    retainedEvidence: [], issues: [] };
  const issues = integrity(review);
  if (issues.length) return { ...base, issues };
  const impact = analyzeReviewImpact(review);
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
  const actions = blocked.map(r => ({ type: 'obtain-passing-evidence', requirementId: r.requirementId,
    version: r.version, reasons: [...r.reasons] }));
  actions.push({ type: 'request-explicit-approval' });
  return { ...state, disposition: impact.activeRevalidation ? 'revalidate' : 'initial-approval',
    minimumActions: actions.length, actions, retainedEvidence };
}
