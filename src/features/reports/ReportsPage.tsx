import { AlertTriangle, CheckCircle2, Layers3, History, FileCheck } from 'lucide-react';
import { Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { ReviewData, ReviewSummary } from '../../shared/types/review';
import { buildReport } from './report-model.mjs';
import './reports.css';

const recordedDate = (value: string) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }) : 'Date unavailable';
};

export function ReportsPage({ review, summary }: { review: ReviewData; summary: ReviewSummary }) {
  const report = buildReport(review, summary);
  return <div className="report-page">
    <Panel title={`Verification report - ${review.issueKey}`} aside={<StatusBadge state={summary.status}/> }>
      <p className="muted">{review.summary} | Revision {review.revision}</p>
      <div className="metrics">
        <StatCard value={summary.mandatory} label="Mandatory" icon={Layers3}/>
        <StatCard value={summary.covered} label="Satisfied" icon={CheckCircle2}/>
        <StatCard value={summary.blockers.length} label="Blockers" icon={AlertTriangle}/>
        <StatCard value={report.coveragePercent === null ? 'N/A' : `${Number(report.coveragePercent.toFixed(1))}%`} label="Mandatory coverage" icon={FileCheck}/>
      </div>
      <p>{report.coveragePercent === null ? 'No mandatory requirements; coverage is not applicable.' : `${summary.covered} of ${summary.mandatory} mandatory requirements satisfied.`}</p>
      <p className="muted">Evidence coverage and the recorded approval status are separate. This report summarizes recorded results; it does not run or independently verify tests.</p>
      <h3>Requirement coverage</h3>
      {!summary.rows.length && <p className="muted">No requirements recorded.</p>}
      {summary.rows.map(row => <div className="stack-line report-row" key={row.id}>
        <div><b>{row.id} v{row.version}</b><p>{row.title}</p><small>{row.mandatory ? 'Mandatory' : 'Optional'} | Latest evidence: {row.latestEvidence?.id ?? 'None'}</small></div><StatusBadge state={row.state}/>
      </div>)}
    </Panel>
    <Panel title="Evidence traceability" aside={<span>{report.evidenceCounts.total} records</span>}>
      <div className="report-metrics">
        <span>Current: <b>{report.evidenceCounts.current}</b></span>
        <span>Outdated: <b>{report.evidenceCounts.outdated}</b></span>
        <span>Current failures: <b>{report.evidenceCounts.failedCurrent}</b></span>
      </div>
      {!report.evidence.length && <p className="muted">No evidence recorded.</p>}
      {report.evidence.map((row, index) => <div className="report-record" key={`${row.id}:${index}`}>
        <b>{row.id} | {row.requirementId} v{row.version}</b>
        <p>{row.title}</p><p className="muted">{row.requirementTitle}</p>
        <div className="report-metrics"><span>Recorded result: <b>{row.result}</b></span><span>Applicability: <b>{row.applicability}</b></span></div>
        {!row.url && <small className="muted">No evidence URL recorded.</small>}
      </div>)}
    </Panel>
    <Panel title="Change and revalidation">
      <div className="metrics">
        <StatCard value={report.historyCounts.total} label="Audit events" icon={History}/>
        <StatCard value={report.historyCounts.revalidation} label="Recorded revalidations" icon={AlertTriangle}/>
      </div>
      <p><b>Active revalidation:</b> {report.activeRevalidation ? 'Required' : 'Not indicated by current status'}</p>
      <p className="muted">Historical revalidation events do not necessarily indicate an active blocker.</p>
    </Panel>
    <Panel title="Recorded decisions" aside={<span>{report.decisions.length} events</span>}>
      {!report.decisions.length && <p className="muted">No decision events recorded.</p>}
      {report.decisions.map(({key, label, event, detail}) => <div className="report-record" key={key}>
        <b>{label}</b><p className="muted">{recordedDate(event.createdAt)}</p>
        <p>{event.description}</p>
        {detail.kind === 'decision' ? <>
          <p>Recorded note: {detail.note || 'Not recorded'}</p>
          {detail.snapshot.length ? <ul>{detail.snapshot.map((entry, i) => <li key={i}>{entry.requirementId || 'Unknown requirement'} v{entry.version ?? '?'} | {entry.evidenceId || 'Unknown evidence'}</li>)}</ul> : <p className="muted">No evidence snapshot recorded.</p>}
        </> : <p className="muted">Historical detail could not be uniquely matched to a stored record.</p>}
      </div>)}
      <p className="muted">The existing JSON export includes raw review records, internal identifiers, and coverage. Share it only with authorized recipients. PDF export is not available yet.</p>
    </Panel>
  </div>;
}
