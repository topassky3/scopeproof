import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, blankReview, exampleReview } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic } from '../src/features/reports/report-intelligence.js';
const cmd = (r, type, props = {}) => applyCommand(r, {type, expectedRevision:r.revision, ...props}, 'QA');
const pass = (r, id='RQ-01') => cmd(r, 'addEvidence', {requirementId:id, title:'Passing test', result:'passed'});
const report = r => buildReportDiagnostic(buildReviewIntelligence(r));
const empty = () => blankReview({id:'1',key:'T-1',summary:'Test',projectId:'2',projectKey:'T'});

test('Report diagnostic: preserves exact canonical impact and plan without mutating records', () => {
  const r = exampleReview(), before = structuredClone(r), intelligence = buildReviewIntelligence(r);
  const p = buildReportDiagnostic(intelligence);
  assert.equal(p.schemaVersion, 1);
  assert.deepEqual(p.diagnostic, intelligence);
  assert.equal(p.diagnostic.revision, r.revision);
  assert.deepEqual(r,before);
  assert.deepEqual(p.comparison, {baseline:'all-mandatory-evidence-plus-approval',fullOperations:4,minimalOperations:2,avoidedOperations:2,theoretical:true});
});
test('Report diagnostic: full coverage still requires explicit reapproval', () => {
  const p = report(pass(exampleReview()));
  assert.equal(p.diagnostic.impact.coveragePercent,100);
  assert.equal(p.diagnostic.impact.status,'revalidation');
  assert.equal(p.comparison.minimalOperations,1);
  assert.equal(p.comparison.avoidedOperations,3);
  assert.deepEqual(p.diagnostic.plan.actions,[{type:'request-explicit-approval'}]);
});
test('Report diagnostic: valid approval is not a revalidation comparison', () => {
  const p = report(cmd(pass(exampleReview()),'approve'));
  assert.equal(p.diagnostic.plan.disposition,'no-action');
  assert.equal(p.diagnostic.plan.minimumActions,0);
  assert.equal(p.comparison,null);
});
test('Report diagnostic: initial approval is not recovery of prior approval', () => {
  const r = cmd(empty(),'addRequirement',{title:'Mandatory check'}), p = report(r);
  assert.equal(p.diagnostic.plan.disposition,'initial-approval');
  assert.equal(p.diagnostic.plan.minimumActions,2);
  assert.equal(p.comparison,null);
});
test('Report diagnostic: empty and optional-only scope have no coverage or comparison', () => {
  for(const r of [empty(),cmd(empty(),'addRequirement',{title:'Optional check',mandatory:false})]) {
    const p=report(r); assert.equal(p.diagnostic.impact.coveragePercent,null);
    assert.equal(p.diagnostic.plan.minimumActions,null); assert.equal(p.comparison,null);
  }
});
test('Report diagnostic: rejection has no automatic recovery comparison', () => {
  const p=report(cmd(pass(exampleReview()),'reject',{note:'Human review needed'}));
  assert.equal(p.diagnostic.plan.disposition,'human-review');
  assert.equal(p.diagnostic.plan.minimumActions,null); assert.equal(p.comparison,null);
});
test('Report diagnostic: inconsistent records suppress impact and comparison', () => {
  const r=exampleReview(); r.evidence.push(structuredClone(r.evidence[0]));
  for(const invalid of [r,null]) {
    const p=report(invalid); assert.equal(p.diagnostic.kind,'unavailable');
    assert.equal(p.diagnostic.impact,null); assert.equal(p.comparison,null);
    assert.ok(p.diagnostic.plan.issues.length);
  }
});
test('Report diagnostic: baseline excludes optional scope and zero saving is possible', () => {
  let r=exampleReview(); r=cmd(r,'addRequirement',{title:'Optional check',mandatory:false});
  for(const id of ['RQ-02','RQ-03']) r=cmd(r,'addEvidence',{requirementId:id,title:'Latest failure',result:'failed'});
  const p=report(r); assert.equal(p.comparison.fullOperations,4);
  assert.equal(p.comparison.minimalOperations,4); assert.equal(p.comparison.avoidedOperations,0);
});
test('Report diagnostic: detached serializable snapshot preserves revision', () => {
  const r=exampleReview(), i=buildReviewIntelligence(r), p=buildReportDiagnostic(i);
  const snapshot=JSON.stringify(p); i.plan.actions.length=0;
  assert.equal(JSON.stringify(p),snapshot);
  assert.deepEqual(JSON.parse(snapshot),p);
  assert.notEqual(report(pass(r)).diagnostic.revision,p.diagnostic.revision);
});
