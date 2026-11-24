// A local, read-only export. No network resources, raw Jira account IDs or HTML.
import { buildReport } from './report-model.mjs';
import { buildReportDiagnostic, canPublishReport } from './report-intelligence.js';
import { buildReviewIntelligence } from '../../shared/review-intelligence.js';
import { impactReasonLabel } from '../overview/overview-intelligence.js';
import { reviewDecisionPresentation } from '../reviews/reviews-intelligence.js';

const text = value => typeof value === 'string' ? value : '';
const date = value => {
  const d = new Date(value);
  return value && Number.isFinite(d.getTime()) ? d.toISOString() : 'Date unavailable';
};
const labels = {approved:'Approved', revalidation:'Revalidation required', ready:'Ready to approve', 'in-review':'In review', pending:'Pending', rejected:'Rejected'};
const section = value => ({ text: value, style: 'section' });
const line = value => ({ text: value, margin: [0, 2, 0, 3] });
const boldLine = value => ({ ...line(value), bold: true });
const empty = value => ({ ...line(value), color: '#526579' });

export function buildPdfDefinition(review, summary, generatedAt, reportDiagnostic = buildReportDiagnostic(buildReviewIntelligence(review))) {
  if (!canPublishReport(review, summary, reportDiagnostic)) throw new Error('REPORT_INSPECTION_REQUIRED');
  const { diagnostic, comparison, schemaVersion } = reportDiagnostic;
  const { impact, plan } = diagnostic;
  const presentation = reviewDecisionPresentation(diagnostic);
  const report = buildReport(review, summary);
  const pct = report.coveragePercent === null ? 'N/A' : `${Number(report.coveragePercent.toFixed(1))}%`;
  const content = [
    {text:'ScopeProof', style:'brand'},
    {text:'DELIVERY ASSURANCE REPORT', style:'subtitle'},
    boldLine(`${review.issueKey} | Revision ${review.revision}`),
    line(text(review.summary)), line(`Generated (UTC): ${date(generatedAt)}`),
    section('01 / Verification summary'),
    boldLine(`Status: ${labels[summary.status] ?? text(summary.status)}`),
    line(`Mandatory coverage: ${pct} (${summary.covered}/${summary.mandatory}) | Blockers: ${summary.blockers.length}`),
    line('Coverage and approval are separate. This report summarizes recorded results; it does not independently verify test execution.'),
    section('02 / Requirement coverage'),
  ];
  if (!summary.rows.length) content.push(empty('No requirements recorded.'));
  for (const row of summary.rows) {
    content.push(boldLine(`${row.id} v${row.version} | ${row.mandatory ? 'Mandatory' : 'Optional'} | ${row.state}`), line(text(row.title)), line(`Latest evidence: ${row.latestEvidence?.id ?? 'None'}`));
  }
  content.push(section('03 / Evidence traceability'), line(`Records: ${report.evidenceCounts.total} | Current: ${report.evidenceCounts.current} | Outdated: ${report.evidenceCounts.outdated} | Current failures: ${report.evidenceCounts.failedCurrent}`));
  if (!report.evidence.length) content.push(empty('No evidence recorded.'));
  for (const row of report.evidence) {
    content.push(boldLine(`${row.id} | ${row.requirementId} v${row.version}`), line(text(row.title)), line(text(row.requirementTitle)), line(`Recorded result: ${row.result} | Applicability: ${row.applicability}`), line(row.url ? 'Evidence URL recorded (omitted from this report).' : 'No evidence URL recorded.'));
  }
  content.push(section('04 / Change and revalidation'), line(`Audit events: ${report.historyCounts.total} | Recorded revalidations: ${report.historyCounts.revalidation}`), line(`Active revalidation: ${report.activeRevalidation ? 'Required' : 'Not indicated by current status'}`), line('Historical revalidation events do not necessarily indicate an active blocker.'), section('05 / Recorded decisions'));
  if (!report.decisions.length) content.push(empty('No decision events recorded.'));
  for (const {label,event,detail} of report.decisions) {
    content.push(boldLine(`${label} | ${date(event.createdAt)}`), line(text(event.description)));
    if (detail.kind !== 'decision') { content.push(empty('Historical detail could not be uniquely matched to a stored record.')); continue; }
    content.push(line(`Recorded note: ${detail.note || 'Not recorded'}`));
    if (!detail.snapshot.length) content.push(empty('No evidence snapshot recorded.'));
    for (const entry of detail.snapshot) content.push(line(`${entry.requirementId || 'Unknown requirement'} v${entry.version ?? '?'} | ${entry.evidenceId || 'Unknown evidence'}`));
  }
  content.push(section('06 / Causal impact and recovery'),
    line(`Diagnostic schema: v${schemaVersion} | Revision ${diagnostic.revision}`),
    boldLine(presentation.heading), line(presentation.message),
    line(`Minimum operations: ${plan.minimumActions ?? 'N/A'} | Passing evidence retained in plan: ${plan.minimumActions === null ? 'N/A' : plan.retainedEvidence.length}`));
  for (const reason of impact.reviewReasons) content.push(line(impactReasonLabel(reason)));
  for (const row of impact.requirements.filter(row => row.reasons.length > 0)) {
    content.push(boldLine(`${row.requirementId} v${row.version}`),
      line(`Approved version: ${row.previousVersion === null ? 'Not recorded' : `v${row.previousVersion}`} | Approved evidence: ${row.previousEvidenceId ?? 'Not recorded'} | Current evidence: ${row.evidenceId ?? 'None'}`));
    for (const reason of row.reasons) content.push(line(impactReasonLabel(reason)));
  }
  if (plan.actions.length) {
    content.push(boldLine('Recommended operations'));
    plan.actions.forEach((action, index) => content.push(line(`${index + 1}. ${action.type === 'obtain-passing-evidence' ? `Obtain current passing evidence for ${action.requirementId} v${action.version}` : 'Request explicit approval'}`)));
  }
  if (plan.retainedEvidence.length) {
    content.push(boldLine('Retained evidence'));
    for (const row of plan.retainedEvidence) content.push(line(`${row.requirementId} v${row.version} | ${row.evidenceId}`));
  }
  if (comparison) content.push(boldLine('Theoretical recovery comparison'),
    line(`Full revalidation: ${comparison.fullOperations} | Minimal recovery: ${comparison.minimalOperations} | Avoided operations: ${comparison.avoidedOperations}`),
    line('Hypothetical baseline: renew every mandatory evidence record and request explicit approval, assuming fixed scope and equal unit operation costs. Not measured time or financial savings.'));
  content.push(line('Advisory only. Passing evidence is recorded, not independently verified. No operation or approval is executed by this report.'));
  content.push(section('07 / Scope and confidentiality'), line('Snapshot of the loaded review, not a live certificate. Raw actor and internal record identifiers and evidence URLs are omitted as structured fields. Free-text descriptions and notes may contain sensitive information. Share only with authorized recipients.'));
  return {
    pageSize:'A4', pageMargins:[44,44,44,52],
    info:{title:`ScopeProof - ${review.issueKey} - revision ${review.revision}`, author:'ScopeProof'},
    defaultStyle:{font:'Roboto',fontSize:10,color:'#233345',lineHeight:1.15},
    styles:{brand:{fontSize:26,bold:true,color:'#174b76'},subtitle:{fontSize:10,bold:true,color:'#526579',margin:[0,0,0,14]},section:{fontSize:14,bold:true,color:'#174b76',margin:[0,14,0,5]}},
    footer:(page,total)=>({text:`ScopeProof | ${review.issueKey} | Revision ${review.revision} | ${page} / ${total}`,alignment:'center',fontSize:9,color:'#526579',margin:[0,15,0,0]}),
    content,
  };
}

export async function downloadReportPdf(review, summary, reportDiagnostic) {
  const definition = buildPdfDefinition(review, summary, new Date().toISOString(), reportDiagnostic);
  const [engine, fonts] = await Promise.all([import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js')]);
  const pdfMake = engine.default;
  pdfMake.addVirtualFileSystem(fonts.default);
  const key = String(review.issueKey).replace(/[^A-Za-z0-9_-]/g, '_');
  await pdfMake.createPdf(definition).download(`scopeproof-${key}-r${review.revision}.pdf`);
}
