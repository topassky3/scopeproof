import { Panel } from '../../shared/components/ui';
import type { ReviewIntelligence } from '../../shared/review-intelligence.js';
import { impactReasonLabel } from '../overview/overview-intelligence.js';
import { reviewDecisionPresentation } from './reviews-intelligence.js';

export function ReviewPlanPanel({ intelligence, historicalOutdatedEvidence }: {
  intelligence: ReviewIntelligence;
  historicalOutdatedEvidence: number | null;
}) {
  const { plan, revision } = intelligence;
  const presentation = reviewDecisionPresentation(intelligence);
  return <Panel title="Review recovery plan" className="rw-impact">
    <p className="muted">Revision {revision ?? 'unavailable'}</p>
    {intelligence.kind === 'unavailable' ? <div role="alert">
      <strong>Diagnostic unavailable</strong><p>{presentation.message}</p>
      <ul>{plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </div> : <>
      <p>{presentation.message}</p>
      {plan.minimumActions !== null && <>
        <div className="rw-impact-grid">
          <div><strong>{plan.minimumActions}</strong><span>Required operations</span></div>
          <div><strong>{plan.retainedEvidence.length}</strong><span>Retained evidence</span></div>
          <div><strong>{plan.actions.filter(action => action.type === 'obtain-passing-evidence').length}</strong><span>Mandatory evidence actions</span></div>
        </div>
        {plan.actions.length ? <ol>{plan.actions.map(action => action.type === 'obtain-passing-evidence'
          ? <li key={action.requirementId}><strong>Obtain passing evidence for {action.requirementId} v{action.version}.</strong>
            <ul>{action.reasons.map(reason => <li key={reason}>{impactReasonLabel(reason)}</li>)}</ul></li>
          : <li key="approval">Request explicit approval.</li>)}</ol>
          : <p>No additional action required.</p>}
        <div><strong>Retained evidence ({plan.retainedEvidence.length})</strong>
          {plan.retainedEvidence.length ? <ul>{plan.retainedEvidence.map(row => <li key={row.requirementId}>{row.requirementId} v{row.version} · {row.evidenceId}</li>)}</ul> : <p>None.</p>}
        </div>
        <p className="muted">Advisory only. Record actual evidence and decisions explicitly.</p>
      </>}
      {historicalOutdatedEvidence !== null && <p className="muted">Historical outdated evidence: {historicalOutdatedEvidence}. Retained for audit, not current coverage.</p>}
    </>}
  </Panel>;
}
