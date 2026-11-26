import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, blankReview, exampleReview, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic, canPublishReport, buildJsonReport } from '../src/features/reports/report-intelligence.js';
import { buildPdfDefinition, downloadReportPdf } from '../src/features/reports/pdf-report.mjs';
import { reviewDecisionPresentation } from '../src/features/reviews/reviews-intelligence.js';
import { impactReasonLabel } from '../src/features/overview/overview-intelligence.js';

const at = '2026-11-24T21:00:00Z';
const cmd = (r, type, props = {}) => applyCommand(r, {type, expectedRevision:r.revision, ...props}, 'QA');
const evidence = (r, requirementId, result='passed') => cmd(r,'addEvidence',{requirementId,result,title:'Recorded test'});
const empty = () => blankReview({id:'1',key:'T-1',summary:'Consistency matrix',projectId:'2',projectKey:'T'});
const initial = () => cmd(empty(),'addRequirement',{title:'Mandatory check'});
const optional = r => cmd(r,'addRequirement',{title:'Optional check',mandatory:false});
const recovered = () => evidence(exampleReview(),'RQ-01');
const approved = () => cmd(recovered(),'approve');
const projection = r => buildReportDiagnostic(buildReviewIntelligence(r));
const lines = definition => definition.content.flatMap(row=>(row.stack??[row]).map(node=>node.text));
const diagnosticLines = definition => {
  const body = lines(definition);
  const start = body.indexOf('06 / Causal impact and recovery');
  const end = body.indexOf('07 / Scope and confidentiality');
  assert.ok(start >= 0 && end > start);
  return body.slice(start+1,end);
};

// Independent expected values, not inferred from the engine being tested.
// Evidence action identifiers contain both requirement and version.
// Retention identifiers specify the exact evidence record.
const cases = [
  ['approved', approved, 'approved',3,3,'no-action',0,[],['RQ-01 v2 | EV-104','RQ-02 v1 | EV-102','RQ-03 v1 | EV-103'],null,'Current review approved'],
  ['mandatory version change', exampleReview,'revalidation',3,2,'revalidate',2,['RQ-01 v2'],['RQ-02 v1 | EV-102','RQ-03 v1 | EV-103'],[4,2,2],'Explicit reapproval required'],
  ['same-version failure',()=>evidence(approved(),'RQ-02','failed'),'revalidation',3,2,'revalidate',2,['RQ-02 v1'],['RQ-01 v2 | EV-104','RQ-03 v1 | EV-103'],[4,2,2],'Explicit reapproval required'],
  ['same-version passing replacement',()=>evidence(approved(),'RQ-02'),'revalidation',3,3,'revalidate',1,[],['RQ-01 v2 | EV-104','RQ-02 v1 | EV-105','RQ-03 v1 | EV-103'],[4,1,3],'Explicit reapproval required'],
  ['restored coverage',recovered,'revalidation',3,3,'revalidate',1,[],['RQ-01 v2 | EV-104','RQ-02 v1 | EV-102','RQ-03 v1 | EV-103'],[4,1,3],'Explicit reapproval required'],
  ['optional change',()=>optional(approved()),'approved',3,3,'no-action',0,[],['RQ-01 v2 | EV-104','RQ-02 v1 | EV-102','RQ-03 v1 | EV-103'],null,'Current review approved'],
  ['mandatory scope addition',()=>cmd(approved(),'addRequirement',{title:'New mandatory check'}),'revalidation',4,3,'revalidate',2,['RQ-04 v1'],['RQ-01 v2 | EV-104','RQ-02 v1 | EV-102','RQ-03 v1 | EV-103'],[5,2,3],'Explicit reapproval required'],
  ['zero theoretical saving',()=>evidence(evidence(exampleReview(),'RQ-02','failed'),'RQ-03','failed'),'revalidation',3,0,'revalidate',4,['RQ-01 v2','RQ-02 v1','RQ-03 v1'],[],[4,4,0],'Explicit reapproval required'],
  ['explicit rejection',()=>cmd(recovered(),'reject',{note:'Human review required'}),'rejected',3,3,'human-review',null,[],[],null,'Review rejected'],
  ['initial incomplete',initial,'in-review',1,0,'initial-approval',2,['RQ-01 v1'],[],null,'Mandatory evidence required'],
  ['initial ready',()=>evidence(initial(),'RQ-01'),'ready',1,1,'initial-approval',1,[],['RQ-01 v1 | EV-101'],null,'Review ready for decision'],
  ['empty scope',empty,'pending',0,0,'define-mandatory-scope',null,[],[],null,'No mandatory requirements yet'],
  ['optional-only scope',()=>optional(empty()),'in-review',0,0,'define-mandatory-scope',null,[],[],null,'No mandatory requirements yet'],
];

for (const [name,make,status,mandatory,covered,disposition,minimum,blocked,retained,comparison,heading] of cases) {
  test(`Report consistency matrix: ${name}`,()=>{
    const r=make(), summary=summarize(r), p=projection(r);
    const before=structuredClone({r,summary,p});
    assert.equal(canPublishReport(r,summary,p),true);
    const j=buildJsonReport(r,summary,p,at), d=j.reportIntelligence.diagnostic;
    assert.equal(d.kind,'available');
    assert.equal(d.revision,r.revision);
    assert.deepEqual([j.coverage.status,j.coverage.mandatory,j.coverage.covered],[status,mandatory,covered]);
    assert.deepEqual([d.impact.status,d.impact.mandatory,d.impact.covered],[status,mandatory,covered]);
    assert.equal(d.impact.coveragePercent,mandatory ? covered/mandatory*100 : null);
    assert.deepEqual([d.plan.disposition,d.plan.minimumActions],[disposition,minimum]);
    const actionable=disposition==='revalidate'||disposition==='initial-approval';
    const actions=[...blocked.map(id=>`Obtain current passing evidence for ${id}`),...(actionable?['Request explicit approval']:[])];
    assert.deepEqual(d.plan.actions.map(a=>a.type==='obtain-passing-evidence'?`Obtain current passing evidence for ${a.requirementId} v${a.version}`:a.type==='request-explicit-approval'?'Request explicit approval':a.type),actions);
    assert.deepEqual(d.plan.retainedEvidence.map(e=>`${e.requirementId} v${e.version} | ${e.evidenceId}`),retained);
    assert.deepEqual(j.reportIntelligence.comparison,comparison?{baseline:'all-mandatory-evidence-plus-approval',fullOperations:comparison[0],minimalOperations:comparison[1],avoidedOperations:comparison[2],theoretical:true}:null);
    assert.deepEqual(j.reportIntelligence,p);
    const pdf=buildPdfDefinition(r,summary,at,p), body=lines(pdf), diagnostic=diagnosticLines(pdf);
    const pct=mandatory?`${Number((covered/mandatory*100).toFixed(1))}%`:'N/A';
    assert.ok(body.includes(`Mandatory coverage: ${pct} (${covered}/${mandatory}) | Blockers: ${mandatory-covered}`));
    assert.ok(diagnostic.includes(`Diagnostic schema: v1 | Revision ${r.revision}`));
    assert.equal(reviewDecisionPresentation(d).heading,heading);
    assert.ok(diagnostic.includes(heading));
    assert.ok(diagnostic.includes(reviewDecisionPresentation(d).message));
    assert.ok(diagnostic.includes(`Minimum operations: ${minimum??'N/A'} | Passing evidence retained in plan: ${minimum===null?'N/A':retained.length}`));
    assert.deepEqual(diagnostic.filter(line=>/^\d+\. /.test(line)),actions.map((a,i)=>`${i+1}. ${a}`));
    const retainedStart=diagnostic.indexOf('Retained evidence');
    assert.equal(retainedStart>=0,retained.length>0);
    if(retained.length) assert.deepEqual(diagnostic.slice(retainedStart+1,retainedStart+1+retained.length),retained);
    for(const reason of [...d.impact.reviewReasons,...d.impact.requirements.flatMap(x=>x.reasons)]) assert.ok(diagnostic.includes(impactReasonLabel(reason)),reason);
    assert.equal(diagnostic.includes('Theoretical recovery comparison'),Boolean(comparison));
    if(comparison) assert.ok(diagnostic.includes(`Full revalidation: ${comparison[0]} | Minimal recovery: ${comparison[1]} | Avoided operations: ${comparison[2]}`));
    assert.deepEqual({r,summary,p},before);
  });
}

test('Report consistency matrix: invalid records block both export builders and PDF download',async()=>{
  const duplicate=exampleReview(); duplicate.evidence.push(structuredClone(duplicate.evidence[0]));
  const missing=exampleReview(); missing.approvals[0].snapshot[0].evidenceId='EV-unknown';
  for(const r of [duplicate,missing]) {
    const summary=summarize(r), p=projection(r);
    assert.equal(p.diagnostic.kind,'unavailable');
    assert.equal(canPublishReport(r,summary,p),false);
    assert.throws(()=>buildJsonReport(r,summary,p,at),/REPORT_INSPECTION_REQUIRED/);
    assert.throws(()=>buildPdfDefinition(r,summary,at,p),/REPORT_INSPECTION_REQUIRED/);
    await assert.rejects(downloadReportPdf(r,summary,p),/REPORT_INSPECTION_REQUIRED/);
  }
});

test('Report consistency matrix: stale projection cannot be published after a new revision',async()=>{
  const r=exampleReview(), p=projection(r), current=evidence(r,'RQ-01'), summary=summarize(current);
  assert.equal(canPublishReport(current,summary,p),false);
  assert.throws(()=>buildJsonReport(current,summary,p,at),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>buildPdfDefinition(current,summary,at,p),/REPORT_INSPECTION_REQUIRED/);
  await assert.rejects(downloadReportPdf(current,summary,p),/REPORT_INSPECTION_REQUIRED/);
});
