// Presentation only: all approval, impact and planning rules stay in the domain.
import { buildReviewIntelligence } from '../../shared/review-intelligence.js';

/** @type {Record<import('../../shared/review-intelligence.js').ImpactReason, string>} */
const reasonLabels = {
  NO_MANDATORY_REQUIREMENTS: 'No mandatory requirements are defined.',
  MANDATORY_IDS_AMBIGUOUS: 'Mandatory requirement identifiers are ambiguous.',
  SNAPSHOT_INVALID: 'The approval snapshot is invalid.',
  SNAPSHOT_SCOPE_MISMATCH: 'The snapshot contains inconsistent scope.',
  MANDATORY_SCOPE_NOT_IN_SNAPSHOT: 'Mandatory requirement is absent from the approval snapshot.',
  REQUIREMENT_VERSION_CHANGED: 'Requirement version differs from the approved version.',
  EVIDENCE_SUPERSEDED: 'Evidence differs from the previously approved evidence.',
  SNAPSHOT_EVIDENCE_UNVERIFIED: 'The historical evidence reference cannot be verified.',
  EVIDENCE_MISSING: 'Current evidence is missing.',
  EVIDENCE_FAILED: 'The latest current evidence failed.',
  FRESH_APPROVAL_REQUIRED: 'Coverage is complete; a fresh explicit approval is required.',
};

/** @param {import('../../shared/review-intelligence.js').ImpactReason} reason */
export function impactReasonLabel(reason) { return reasonLabels[reason] ?? reason; }

/** @param {unknown} review */
export function buildOverviewIntelligence(review) {
  const intelligence = buildReviewIntelligence(review);
  if (intelligence.kind === 'unavailable') return {
    intelligence, message: 'Inspect records before relying on coverage or recovery advice.',
  };
  const { impact, plan } = intelligence;
  let message;
  switch (plan.disposition) {
    case 'no-action': message = 'The current approval matches the mandatory evidence snapshot.'; break;
    case 'human-review': message = 'The latest decision is a rejection. Human review is required.'; break;
    case 'define-mandatory-scope': message = 'Define mandatory requirements before requesting approval.'; break;
    case 'revalidate': message = impact.covered === impact.mandatory
      ? 'All mandatory requirements have current passing evidence. A fresh explicit approval is still required.'
      : 'Some mandatory requirements need current passing evidence before a fresh approval.'; break;
    case 'initial-approval': message = impact.covered === impact.mandatory
      ? 'All mandatory requirements have current passing evidence. An initial explicit approval is required.'
      : 'Obtain current passing evidence for the blocked mandatory requirements before approval.'; break;
    default: message = 'Inspect the review before proceeding.';
  }
  return { intelligence, message };
}

/**
 * Suppress the selected row's recorded status when planning integrity failed.
 * Other project rows have not been individually inspected.
 * @param {import('../../shared/types/review').ReviewListItem[]} rows
 * @param {string} selectedKey
 * @param {import('../../shared/review-intelligence.js').ReviewIntelligence} intelligence
 */
export function projectOverviewRows(rows, selectedKey, intelligence) {
  return rows.map(row => intelligence.kind === 'unavailable' && row.issueKey === selectedKey
    ? { ...row, status: 'inspection-required' } : row);
}
