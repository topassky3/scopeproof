import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, exampleReview, applyCommand, summarize } from '../src/domain.js';
import { inspectReviewRecords } from '../src/review-integrity.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic, canPublishReport, buildJsonReport } from '../src/features/reports/report-intelligence.js';
import { buildPdfDefinition } from '../src/features/reports/pdf-report.mjs';
const at='2026-11-26T14:00:00Z';
const cmd=(r,type,props={})=>applyCommand(r,{type,expectedRevision:r.revision,...props},'QA');
const empty=()=>blankReview({id:'1',key:'T-1',summary:'Synthetic integrity test',projectId:'2',projectKey:'T'});
const initial=()=>cmd(empty(),'addRequirement',{title:'Mandatory check'});
const pass=(r,id='RQ-01',url='')=>cmd(r,'addEvidence',{requirementId:id,result:'passed',title:'Recorded check',url});
const approved=()=>cmd(pass(exampleReview()),'approve');
const rejected=()=>cmd(approved(),'reject',{note:'Human review required'});
const projection=r=>buildReportDiagnostic(buildReviewIntelligence(r));
function invalid(r,issue,{summarySafe=true}={}) {
  const before=structuredClone(r), p=projection(r);
  assert.ok(inspectReviewRecords(r).includes(issue));
  assert.equal(p.diagnostic.kind,'unavailable');
  assert.equal(p.diagnostic.plan.minimumActions,null);
  assert.deepEqual(p.diagnostic.plan.actions,[]);
  if(summarySafe) {
    const s=summarize(r);
    assert.equal(canPublishReport(r,s,p),false);
    assert.throws(()=>buildJsonReport(r,s,p,at),/REPORT_INSPECTION_REQUIRED/);
    assert.throws(()=>buildPdfDefinition(r,s,at,p),/REPORT_INSPECTION_REQUIRED/);
  }
  for(const [type,props] of [['approve',{}],['reject',{note:'Human decision'}],['addRequirement',{title:'Additional check'}],['publishVersion',{requirementId:'RQ-01',title:'Changed check'}],['addEvidence',{requirementId:'RQ-01',title:'Passing check',result:'passed'}]]) {
    assert.throws(()=>cmd(r,type,props),/REVIEW_INSPECTION_REQUIRED/);
  }
  assert.deepEqual(r,before);
}
test('Integrity: A07 null requirement blocks planning and commands; raw summary consumers handled separately',()=>{
  const r=exampleReview();r.requirements.push(null);invalid(r,'INVALID_REQUIREMENT',{summarySafe:false});
});
test('Integrity: A08 null historical version blocks publication before PDF rendering',()=>{
  const r=approved();r.requirements[0].versions.unshift(null);invalid(r,'INVALID_REQUIREMENT_VERSION');
});
test('Integrity: malformed, duplicate or future version records are refused',()=>{
  for(const value of [{version:0,title:'Bad'},{version:99,title:'Future'},{version:1,title:'Duplicate'},{}]) {
    const r=approved();r.requirements[0].versions.push(value);invalid(r,'INVALID_REQUIREMENT_VERSION');
  }
});
test('Integrity: A09 null historical event blocks publication and commands',()=>{
  const r=approved();r.events.unshift(null);invalid(r,'INVALID_AUDIT_EVENT');
});
test('Integrity: A10 null older decision is not ignored',()=>{
  const r=approved();r.approvals.unshift(null);invalid(r,'INVALID_HISTORICAL_DECISION');
});
test('Integrity: A11 rejects nonempty rejection snapshots in any historical position',()=>{
  for(const latest of [true,false]) {
    let r=rejected();const decision=r.approvals.at(-1);
    if(!latest) r=cmd(r,'approve');
    const index=r.approvals.findIndex(a=>a.id===decision.id);
    r.approvals[index].snapshot=structuredClone(r.approvals[0].snapshot);
    invalid(r,'INVALID_REJECTION_SNAPSHOT');
  }
});
test('Integrity: historical approval references must resolve exactly',()=>{
  const r=approved();r.approvals[0].snapshot[0].evidenceId='EV-unknown';invalid(r,'SNAPSHOT_EVIDENCE_UNVERIFIED');
});
test('Integrity: A12 all mutation commands block duplicate evidence even with recorded approved status',()=>{
  const r=approved();r.evidence.push(structuredClone(r.evidence[0]));assert.equal(summarize(r).status,'approved');invalid(r,'AMBIGUOUS_EVIDENCE_ID');
});
test('Integrity: A13 revision overflow is blocked without mutation or impossible recovery advice',()=>{
  const r=initial();r.revision=Number.MAX_SAFE_INTEGER;
  const before=structuredClone(r);assert.throws(()=>pass(r),/REVISION_CAPACITY_EXCEEDED/);
  assert.equal(buildReviewIntelligence(r).kind,'unavailable');assert.deepEqual(r,before);
});
test('Integrity: requirement version overflow is blocked',()=>{
  const r=initial();r.requirements[0].version=Number.MAX_SAFE_INTEGER;
  const before=structuredClone(r);assert.throws(()=>cmd(r,'publishVersion',{requirementId:'RQ-01',title:'Changed check'}),/VERSION_CAPACITY_EXCEEDED/);assert.deepEqual(r,before);
});
test('Integrity: A14 requirement and evidence ID collisions are blocked at mutation boundary',()=>{
  const r=initial();r.requirements[0].id='RQ-02';const before=structuredClone(r);
  assert.throws(()=>cmd(r,'addRequirement',{title:'Another check'}),/REQUIREMENT_ID_ALLOCATION_COLLISION/);assert.deepEqual(r,before);
  const e=pass(initial());e.evidence[0].id='EV-102';const copy=structuredClone(e);
  assert.throws(()=>pass(e),/EVIDENCE_ID_ALLOCATION_COLLISION/);assert.deepEqual(e,copy);
});
test('Integrity: A15 invalid HTTPS URLs fail without truncation, valid and empty URLs work',()=>{
  const r=initial(),before=structuredClone(r);
  for(const url of ['https://','https:///example.com','http://example.com','https://user:pass@example.com','https://example.com/has space','https://example.com/'+ 'x'.repeat(500)]) assert.throws(()=>pass(r,'RQ-01',url),/HTTPS/);
  for(const url of ['', 'https://example.com/test?x=1']) assert.equal(pass(r,'RQ-01',url).evidence[0].url,url);
  assert.deepEqual(r,before);
});
test('Integrity: legitimate history, rejection and explicit reapproval remain supported',()=>{
  const r=rejected();assert.deepEqual(inspectReviewRecords(r),[]);
  assert.equal(buildReviewIntelligence(r).plan.disposition,'human-review');
  const renewed=cmd(r,'approve');assert.equal(summarize(renewed).status,'approved');assert.deepEqual(renewed.approvals.slice(0,-1),r.approvals);
  const p=projection(renewed);assert.equal(canPublishReport(renewed,summarize(renewed),p),true);
});
