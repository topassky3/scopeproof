// Read-only selection of facts already computed by Review Intelligence.
/**
 * @param {import('./review-intelligence.js').ReviewIntelligence} intelligence
 * @param {string} requirementId
 */
export function requirementTrace(intelligence, requirementId) {
  if (intelligence.kind !== 'available') return null;
  const impact = intelligence.impact.requirements.find(row => row.requirementId === requirementId);
  if (!impact) return null;
  const { plan } = intelligence;
  const requiresEvidence = plan.actions.some(action => action.type === 'obtain-passing-evidence' &&
    action.requirementId === impact.requirementId && action.version === impact.version);
  const retained = plan.retainedEvidence.some(row => row.requirementId === impact.requirementId &&
    row.version === impact.version && row.evidenceId === impact.evidenceId);
  return { impact, requiresEvidence, retained };
}

/**
 * @param {import('./review-intelligence.js').ReviewIntelligence} intelligence
 * @param {{ id: string, requirementId: string, version: number, result: 'passed' | 'failed' }} evidence
 */
export function evidenceTrace(intelligence, evidence) {
  if (intelligence.kind !== 'available') return null;
  const trace = requirementTrace(intelligence, evidence.requirementId);
  if (!trace) return { mandatory: false, retained: false, inLatestApprovedSnapshot: false };
  const { impact } = trace;
  return {
    mandatory: true,
    retained: trace.retained && evidence.result === 'passed' && evidence.version === impact.version && evidence.id === impact.evidenceId,
    inLatestApprovedSnapshot: evidence.result === 'passed' && evidence.version === impact.previousVersion && evidence.id === impact.previousEvidenceId,
  };
}
