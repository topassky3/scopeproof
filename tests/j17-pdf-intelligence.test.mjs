import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleReview, blankReview, applyCommand, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic, buildJsonReport } from '../src/features/reports/report-intelligence.js';
import { buildPdfDefinition, downloadReportPdf } from '../src/features/reports/pdf-report.mjs';
import { impactReasonLabel } from '../src/features/overview/overview-intelligence.js';
import { reviewDecisionPresentation } from '../src/features/reviews/reviews-intelligence.js';
const at = '2026-11-24T21:00:00Z';
const command = (r,type,props={}) => applyCommand(r,{type,expectedRevision:r.revision,...props},'QA');
const pass = r => command(r,'addEvidence',{requirementId:'RQ-01',title:'Passing test',result:'passed'});
const report = r => buildReportDiagnostic(buildReviewIntelligence(r));
const doc = (r,p=report(r)) => buildPdfDefinition(r,summarize(r),at,p);
const body = r => doc(r).content.flatMap(row=>(row.stack??[row]).map(node=>node.text)).join('\n');

test('PDF intelligence: matches JSON diagnosis, causes, actions and retained evidence without mutation',()=>{
  const r=exampleReview(), p=report(r), s=summarize(r), before=structuredClone({r,p,s});
  const j=buildJsonReport(r,s,p,at).reportIntelligence, d=j.diagnostic;
  const text=buildPdfDefinition(r,s,at,p).content.flatMap(row=>(row.stack??[row]).map(node=>node.text)).join('\n');
  for(const value of [`Diagnostic schema: v${j.schemaVersion} | Revision ${d.revision}`,reviewDecisionPresentation(d).heading,reviewDecisionPresentation(d).message,
    `Minimum operations: ${d.plan.minimumActions}`,`Full revalidation: ${j.comparison.fullOperations} | Minimal recovery: ${j.comparison.minimalOperations} | Avoided operations: ${j.comparison.avoidedOperations}`,
    ...d.impact.reviewReasons.map(impactReasonLabel),...d.impact.requirements.flatMap(row=>row.reasons.map(impactReasonLabel)),
    ...d.plan.retainedEvidence.map(row=>`${row.requirementId} v${row.version} | ${row.evidenceId}`),
    '1. Obtain current passing evidence for RQ-01 v2','2. Request explicit approval','Not measured time or financial savings.']) assert.ok(text.includes(value),value);
  assert.deepEqual({r,p,s},before);
});
test('PDF intelligence: complete coverage still requires explicit reapproval',()=>{
  const text=body(pass(exampleReview()));
  for(const value of ['Mandatory coverage: 100%','Explicit reapproval required','Minimum operations: 1','1. Request explicit approval','Avoided operations: 3']) assert.ok(text.includes(value),value);
  assert.doesNotMatch(text,/Obtain current passing evidence for RQ-01/);
});
test('PDF intelligence: approved, rejected and initial decisions have no recovery comparison',()=>{
  const r=pass(exampleReview());
  const initial=command(blankReview({id:'1',key:'T-1',summary:'Empty',projectId:'2',projectKey:'T'}),'addRequirement',{title:'Mandatory check'});
  for(const [review,heading,ops] of [[command(r,'approve'),'Current review approved','0'],[command(r,'reject',{note:'Human review needed'}),'Review rejected','N/A'],[initial,'Mandatory evidence required','2']]) {
    const text=body(review); assert.ok(text.includes(heading)); assert.ok(text.includes(`Minimum operations: ${ops}`));
    assert.doesNotMatch(text,/Theoretical recovery comparison/);
  }
});
test('PDF intelligence: zero mandatory scope remains N/A',()=>{
  const r=blankReview({id:'1',key:'T-1',summary:'Empty',projectId:'2',projectKey:'T'});
  for(const review of [r,command(r,'addRequirement',{title:'Optional check',mandatory:false})]) {
    const text=body(review); assert.match(text,/Mandatory coverage: N\/A/); assert.match(text,/Minimum operations: N\/A/);
    assert.doesNotMatch(text,/Theoretical recovery comparison|Recommended operations/);
  }
});
test('PDF intelligence: invalid and stale supplied projections block before rendering or download',async()=>{
  const r=exampleReview(), p=report(r), updated=pass(r);
  const invalid=structuredClone(r); invalid.evidence.push(structuredClone(invalid.evidence[0]));
  assert.throws(()=>doc(invalid),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>doc(updated,p),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>buildPdfDefinition(r,{...summarize(r),covered:0},at,p),/REPORT_INSPECTION_REQUIRED/);
  await assert.rejects(downloadReportPdf(updated,summarize(updated),p),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>buildPdfDefinition(invalid,summarize(invalid),at),/REPORT_INSPECTION_REQUIRED/);
});
test('PDF intelligence: diagnostic does not expose structured actor ids, Jira ids or evidence URLs',()=>{
  const r=exampleReview(); r.issueId='private-issue-id'; r.projectId='private-project-id';
  r.evidence[0].url='https://example.com/private-evidence'; r.evidence[0].actor='private-actor-id';
  const text=JSON.stringify(doc(r));
  for(const value of ['private-issue-id','private-project-id','private-evidence','private-actor-id']) assert.ok(!text.includes(value),value);
  assert.match(text,/Share only with authorized recipients/);
});
test('PDF intelligence: large valid scope retains all rows in a deterministic document definition',()=>{
  let r=blankReview({id:'1',key:'T-1',summary:'Large scope',projectId:'2',projectKey:'T'});
  for(let i=0;i<60;i++) r=command(r,'addRequirement',{title:`Mandatory requirement ${i+1}`});
  const d=doc(r), text=d.content.flatMap(row=>(row.stack??[row]).map(node=>node.text)).join('\n');
  assert.match(text,/Minimum operations: 61/); assert.match(text,/60\. Obtain current passing evidence for RQ-60 v1/);
  assert.match(text,/61\. Request explicit approval/); assert.equal(d.pageSize,'A4');
  assert.deepEqual(d.content,doc(r).content);
});
