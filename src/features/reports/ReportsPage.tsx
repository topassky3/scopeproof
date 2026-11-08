import { AlertTriangle, CheckCircle2, Layers3 } from 'lucide-react';
import { Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { ReviewData, ReviewSummary } from '../../shared/types/review';

export function ReportsPage({ review, summary }: { review: ReviewData; summary: ReviewSummary }) {
  return <Panel title={`Verification report · ${review.issueKey}`} aside={<StatusBadge state={summary.status}/>}>
    <div className="metrics">
      <StatCard value={summary.mandatory} label="Mandatory" icon={Layers3}/>
      <StatCard value={summary.covered} label="Satisfied" icon={CheckCircle2}/>
      <StatCard value={summary.blockers.length} label="Blockers" icon={AlertTriangle}/>
    </div>
    <h3>Requirement coverage</h3>
    {summary.rows.map(row => <div className="stack-line" key={row.id}>
      <span>{row.id} v{row.version} · {row.title}</span><StatusBadge state={row.state}/>
    </div>)}
    <p className="muted">The JSON export includes requirement versions, evidence, decisions, and the audit log. PDF export is a later milestone.</p>
  </Panel>;
}
