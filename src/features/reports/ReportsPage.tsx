import { AlertTriangle, CheckCircle2, Layers3, History, FileCheck } from 'lucide-react';
import { Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { ReviewData, ReviewSummary } from '../../shared/types/review';
import { useState } from 'react';
import { buildReport } from './report-model.mjs';
import { downloadReportPdf } from './pdf-report.mjs';
import { buildReportDiagnostic, canPublishReport } from './report-intelligence.js';
import { impactReasonLabel } from '../overview/overview-intelligence.js';
import { reviewDecisionPresentation } from '../reviews/reviews-intelligence.js';
import type { ReviewIntelligence } from '../../shared/review-intelligence.js';
import './reports.css';

const recordedDate = (value: string) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }) : 'Date unavailable';
};

type ReportsProps = { review: ReviewData; summary: ReviewSummary; reportDiagnostic: ReturnType<typeof buildReportDiagnostic> };

export function ReportsPage(props: ReportsProps) {
  const diagnostic = props.reportDiagnostic.diagnostic;
  if (diagnostic.kind !== 'available' || !canPublishReport(props.review, props.summary, props.reportDiagnostic)) {
    return <Panel title="Inspection required">
      <p role="alert">Report diagnosis and ordinary exports are unavailable. Inspect inconsistent or mismatched records before continuing.</p>
      <ul>{diagnostic.plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </Panel>;
  }
  return <AvailableReports {...props} diagnostic={diagnostic}/>;
}

function AvailableReports({ review, summary, reportDiagnostic, diagnostic }: ReportsProps & { diagnostic: Extract<ReviewIntelligence, {kind: 'available'}> }) {
  const report = buildReport(review, summary);
  const { impact, plan } = diagnostic;
  const presentation = reviewDecisionPresentation(diagnostic);
  const comparison = reportDiagnostic.comparison;
  const [exporting, setExporting] = useState(false);
  const [pdfError, setPdfError] = useState('');
  async function exportPdf() {
    if (exporting) return;
    setExporting(true); setPdfError('');
    try { await downloadReportPdf(review, summary); }
    catch { setPdfError('PDF generation or download failed. Please try again.'); }
    finally { setExporting(false); }
  }
  return <div className="report-page">
    <Panel title={`Verification report - ${review.issueKey}`} aside={<StatusBadge state={summary.status}/> }>
      <p className="muted">{review.summary} | Revision {review.revision}</p>
      <button type="button" className="primary" disabled={exporting} onClick={exportPdf}>{exporting ? 'Preparing PDF...' : 'Export PDF'}</button>
      {pdfError && <p role="alert">{pdfError}</p>}
      <p className="muted">PDF currently contains the verification summary and history; the diagnostic and recovery comparison are available in this view and JSON.</p>
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
    <Panel title="Causal impact and recovery" aside={<span>Revision {diagnostic.revision}</span>}>
      <h3>{presentation.heading}</h3>
      <p>{presentation.message}</p>
      <p>Minimum operations: <b>{plan.minimumActions ?? 'N/A'}</b> | Passing evidence retained in plan: <b>{plan.minimumActions === null ? 'N/A' : plan.retainedEvidence.length}</b></p>
      {impact.reviewReasons.length > 0 && <ul>{impact.reviewReasons.map(reason => <li key={reason}>{impactReasonLabel(reason)}</li>)}</ul>}
      {impact.requirements.filter(row => row.reasons.length > 0).map(row => <div className="report-record" key={row.requirementId}>
        <b>{row.requirementId} v{row.version}</b>
        <p>Approved version: {row.previousVersion === null ? 'Not recorded' : `v${row.previousVersion}`} | Approved evidence: {row.previousEvidenceId ?? 'Not recorded'} | Current evidence: {row.evidenceId ?? 'None'}</p>
        <ul>{row.reasons.map(reason => <li key={reason}>{impactReasonLabel(reason)}</li>)}</ul>
      </div>)}
      {plan.actions.length > 0 && <><h3>Recommended operations</h3><ol>{plan.actions.map((action, index) => <li key={index}>
        {action.type === 'obtain-passing-evidence' ? `Obtain current passing evidence for ${action.requirementId} v${action.version}` : 'Request explicit approval'}
      </li>)}</ol></>}
      {plan.retainedEvidence.length > 0 && <><h3>Retained evidence</h3><ul>{plan.retainedEvidence.map(row => <li key={row.requirementId}>{row.requirementId} v{row.version} | {row.evidenceId}</li>)}</ul></>}
      {comparison && <div className="report-record">
        <h3>Theoretical recovery comparison</h3>
        <p>Full revalidation: <b>{comparison.fullOperations}</b> | Minimal recovery: <b>{comparison.minimalOperations}</b> | Avoided operations: <b>{comparison.avoidedOperations}</b></p>
        <p className="muted">Hypothetical baseline: renew every mandatory evidence record and request explicit approval, assuming fixed scope and equal unit operation costs. Not measured time or financial savings.</p>
      </div>}
      <p className="muted">Advisory only. Passing evidence is recorded, not independently verified. No operation or approval is executed by this report.</p>
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
      <p className="muted">The JSON export includes raw review records, internal identifiers, coverage and the versioned diagnostic. Share it only with authorized recipients. PDF omits structured internal identifiers and evidence URLs, but may include sensitive descriptions and notes.</p>
    </Panel>
  </div>;
}
