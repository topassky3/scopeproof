import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, blankReview, exampleReview, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { requirementTrace, evidenceTrace } from '../src/shared/traceability-intelligence.js';
import { buildOverviewIntelligence, projectOverviewRows } from '../src/features/overview/overview-intelligence.js';
import { buildReviewRows, overviewMetrics } from '../src/features/overview/overview-model.js';
import { reviewDecisionPresentation } from '../src/features/reviews/reviews-intelligence.js';
import { buildEvidenceRows } from '../src/features/evidence/evidence-model.mjs';
import { buildReportDiagnostic, canPublishReport, buildJsonReport } from '../src/features/reports/report-intelligence.js';
import { buildPdfDefinition } from '../src/features/reports/pdf-report.mjs';

const at = '2026-11-24T22:00:00Z';
const cmd = (r,type,props={}) => applyCommand(r,{type,expectedRevision:r.revision,...props},'QA');
const evidence = (r,requirementId,result='passed') => cmd(r,'addEvidence',{requirementId,result,title:'Recorded check'});
const recovered = () => evidence(exampleReview(),'RQ-01');
const approved = () => cmd(recovered(),'approve');
const optional = () => evidence(cmd(approved(),'addRequirement',{title:'Optional check',mandatory:false}),'RQ-04');
const failed = () => evidence(approved(),'RQ-02','failed');
const empty = () => blankReview({id:'2',key:'T-2',summary:'Empty review',projectId:'1',projectKey:'T'});
const initial = () => cmd(empty(),'addRequirement',{title:'Mandatory check'});
const other = {issueKey:'OTHER-1',summary:'Other saved review',status:'approved',mandatory:1,covered:1};
const staleRow = r => ({issueKey:r.issueKey,summary:'Stale index',status:'approved',mandatory:99,covered:99});

// Expected values describe the workflow, not the engine's own output.
// Blocked requirements, retained evidence and latest approval snapshot are distinct.
const cases = [
  ['version changed',exampleReview,'revalidation',3,2,2,['RQ-01'],['EV-102','EV-103'],['EV-101','EV-102','EV-103'],'Explicit reapproval required'],
  ['coverage restored',recovered,'revalidation',3,3,1,[],['EV-104','EV-102','EV-103'],['EV-101','EV-102','EV-103'],'Explicit reapproval required'],
  ['reapproved',approved,'approved',3,3,0,[],['EV-104','EV-102','EV-103'],['EV-104','EV-102','EV-103'],'Current review approved'],
  ['optional passing evidence',optional,'approved',3,3,0,[],['EV-104','EV-102','EV-103'],['EV-104','EV-102','EV-103'],'Current review approved'],
  ['failed replacement',failed,'revalidation',3,2,2,['RQ-02'],['EV-104','EV-103'],['EV-104','EV-102','EV-103'],'Explicit reapproval required'],
  ['rejected with coverage',()=>cmd(recovered(),'reject',{note:'Human review required'}),'rejected',3,3,null,[],[],[],'Review rejected'],
  ['initial ready',()=>evidence(initial(),'RQ-01'),'ready',1,1,1,[],['EV-101'],[],'Review ready for decision'],
  ['empty',empty,'pending',0,0,null,[],[],[],'No mandatory requirements yet'],
];

for(const [name,make,status,mandatory,covered,minimum,blocked,retained,snapshot,heading] of cases) {
  test(`Cross-view consistency: ${name}`,()=>{
    const r=make(), before=structuredClone(r), summary=summarize(r);
    const i=buildReviewIntelligence(r), overview=buildOverviewIntelligence(r);
    assert.equal(i.kind,'available');
    assert.deepEqual(overview.intelligence,i);
    assert.equal(i.revision,r.revision);
    const rows=projectOverviewRows(buildReviewRows(r,summary,[other,staleRow(r)]),r.issueKey,i);
    const selected=rows.find(row=>row.issueKey===r.issueKey);
    assert.deepEqual([selected.status,selected.mandatory,selected.covered],[status,mandatory,covered]);
    assert.deepEqual(rows.find(row=>row.issueKey===other.issueKey),other);
    assert.equal(overviewMetrics(rows).approved,status==='approved'?2:1);
    const presentation=reviewDecisionPresentation(i);
    assert.equal(presentation.heading,heading);
    assert.equal(presentation.decisionBlocked,false);
    assert.equal(i.plan.minimumActions,minimum);
    assert.deepEqual([i.impact.status,i.impact.mandatory,i.impact.covered],[status,mandatory,covered]);
    assert.equal(i.impact.coveragePercent,mandatory?covered/mandatory*100:null);
    // Requirements and Evidence must attribute the plan to exact records, not just counts.
    const traces=r.requirements.map(req=>[req,requirementTrace(i,req.id)]);
    assert.deepEqual(traces.filter(([,t])=>t?.requiresEvidence).map(([req])=>req.id),blocked);
    assert.deepEqual(traces.filter(([,t])=>t?.retained).map(([,t])=>t.impact.evidenceId),retained);
    for(const [req,t] of traces) {
      if(!req.mandatory) assert.equal(t,null);
      else assert.equal(t.impact.version,req.version);
    }
    const evidenceRows=buildEvidenceRows(r);
    for(const row of evidenceRows) {
      const t=evidenceTrace(i,row);
      assert.equal(t.mandatory,r.requirements.find(req=>req.id===row.requirementId).mandatory);
      assert.equal(t.retained,retained.includes(row.id));
      assert.equal(t.inLatestApprovedSnapshot,snapshot.includes(row.id));
      if(t.retained) { assert.equal(row.result,'passed'); assert.equal(row.applicability,'current'); }
    }
    const p=buildReportDiagnostic(i), json=buildJsonReport(r,summary,p,at);
    assert.deepEqual(json.reportIntelligence.diagnostic,overview.intelligence);
    const pdf=buildPdfDefinition(r,summary,at,p).content.flatMap(row=>(row.stack??[row]).map(node=>node.text));
    assert.ok(pdf.includes(heading));
    assert.ok(pdf.includes(`Minimum operations: ${minimum??'N/A'} | Passing evidence retained in plan: ${minimum===null?'N/A':retained.length}`));
    assert.deepEqual(r,before);
  });
}

test('Cross-view consistency: ambiguous evidence masks only the selected record and blocks exports',()=>{
  const r=approved(); r.evidence.push(structuredClone(r.evidence[0]));
  const before=structuredClone(r), summary=summarize(r), i=buildReviewIntelligence(r);
  assert.equal(summary.status,'approved'); // Recorded aggregate alone is insufficient.
  assert.equal(i.kind,'unavailable');
  assert.deepEqual(buildOverviewIntelligence(r).intelligence,i);
  const rows=projectOverviewRows(buildReviewRows(r,summary,[other]),r.issueKey,i);
  assert.equal(rows.find(x=>x.issueKey===r.issueKey).status,'inspection-required');
  assert.equal(overviewMetrics(rows).approved,1);
  assert.equal(reviewDecisionPresentation(i).decisionBlocked,true);
  for(const req of r.requirements) assert.equal(requirementTrace(i,req.id),null);
  for(const e of r.evidence) assert.equal(evidenceTrace(i,e),null);
  const p=buildReportDiagnostic(i);
  assert.equal(canPublishReport(r,summary,p),false);
  assert.throws(()=>buildJsonReport(r,summary,p,at),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>buildPdfDefinition(r,summary,at,p),/REPORT_INSPECTION_REQUIRED/);
  assert.deepEqual(r,before);
});
