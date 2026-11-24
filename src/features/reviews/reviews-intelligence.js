// Presentation of the shared advisory result; no writes or approval rules.
/**
 * @param {import('../../shared/review-intelligence.js').ReviewIntelligence} intelligence
 * @returns {{heading: string, message: string, decisionBlocked: boolean}}
 */
export function reviewDecisionPresentation(intelligence) {
  if (intelligence.kind === 'unavailable') return {
    heading: 'Inspection required', message: 'Inspect records before relying on coverage or recording another decision.', decisionBlocked: true,
  };
  const { plan, impact } = intelligence;
  switch (plan.disposition) {
    case 'no-action': return { heading: 'Current review approved', message: 'The current approval matches the mandatory evidence snapshot.', decisionBlocked: false };
    case 'human-review': return { heading: 'Review rejected', message: 'The latest recorded decision is a rejection. Human reconsideration is required before any new decision.', decisionBlocked: false };
    case 'define-mandatory-scope': return { heading: 'No mandatory requirements yet', message: 'Define mandatory scope and obtain passing evidence before approval.', decisionBlocked: false };
    case 'revalidate': return { heading: 'Explicit reapproval required', message: impact.covered === impact.mandatory
      ? 'Coverage is complete. A fresh explicit approval is still required.'
      : 'Obtain current passing evidence for the blocked mandatory requirements before reapproval.', decisionBlocked: false };
    case 'initial-approval': return { heading: impact.covered === impact.mandatory ? 'Review ready for decision' : 'Mandatory evidence required',
      message: impact.covered === impact.mandatory ? 'Coverage is complete. An initial explicit approval is required.'
        : 'Obtain current passing evidence for the blocked mandatory requirements before approval.', decisionBlocked: false };
  }
  return { heading: 'Inspection required', message: 'Unknown planning disposition. Inspect records before continuing.', decisionBlocked: true };
}
