import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankReview, exampleReview, applyCommand, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildOverviewIntelligence as view, impactReasonLabel, projectOverviewRows } from '../src/features/overview/overview-intelligence.js';
import { buildReviewRows, filterReviewRows, overviewMetrics, reviewImpact } from '../src/features/overview/overview-model.js';
const cmd = (r,type,fields={}) => applyCommand(r,{type,expectedRevision:r.revision,...fields},'QA');
const pass = (r,id='RQ-01') => cmd(r,'addEvidence',{requirementId:id,title:'Passing evidence',result:'passed'});
const fresh = () => cmd(pass(exampleReview()),'approve');
const empty = () => blankReview({id:'1',key:'TEST-1',summary:'Empty',projectId:'1',projectKey:'TEST'});

test('Overview intelligence displays the canonical demo plan without mutation',()=>{
  const r=exampleReview(), before=structuredClone(r), v=view(r);
  assert.deepEqual(v.intelligence,buildReviewIntelligence(r));
  assert.equal(v.intelligence.plan.minimumActions,2);
  assert.equal(v.intelligence.plan.retainedEvidence.length,2);
  assert.match(v.message,/need current passing evidence/);
  assert.deepEqual(r,before);
});
test('Overview intelligence distinguishes complete coverage from a fresh approval',()=>{
  const v=view(pass(exampleReview()));
  assert.equal(v.intelligence.impact.coveragePercent,100);
  assert.equal(v.intelligence.plan.minimumActions,1);
  assert.match(v.message,/fresh explicit approval/);
  assert.doesNotMatch(v.message,/need current passing evidence/);
});
test('Overview intelligence retains audit history without active recovery work',()=>{
  const r=fresh(), v=view(r);
  assert.equal(v.intelligence.plan.minimumActions,0);
  assert.match(v.message,/matches the mandatory evidence snapshot/);
  assert.equal(reviewImpact(r,summarize(r)).outdatedEvidence,1);
});
test('Overview intelligence explains a failed replacement',()=>{
  const r=cmd(fresh(),'addEvidence',{requirementId:'RQ-02',title:'Failed check',result:'failed'});
  const v=view(r), row=v.intelligence.impact.requirements.find(x=>x.requirementId==='RQ-02');
  assert.ok(row.reasons.includes('EVIDENCE_FAILED'));
  assert.match(impactReasonLabel('EVIDENCE_FAILED'),/failed/);
  assert.equal(v.intelligence.plan.minimumActions,2);
});
test('Overview intelligence avoids claiming newly added history for uncaptured scope',()=>{
  const r=cmd(fresh(),'addRequirement',{title:'Additional requirement'}), v=view(r);
  assert.ok(v.intelligence.impact.requirements.at(-1).reasons.includes('MANDATORY_SCOPE_NOT_IN_SNAPSHOT'));
  assert.match(impactReasonLabel('MANDATORY_SCOPE_NOT_IN_SNAPSHOT'),/absent/);
});
test('Overview intelligence respects rejection with full coverage',()=>{
  const v=view(cmd(fresh(),'reject',{note:'Human decision'}));
  assert.equal(v.intelligence.plan.disposition,'human-review');
  assert.equal(v.intelligence.plan.minimumActions,null);
  assert.match(v.message,/Human review/);
});
test('Overview intelligence reports empty and initial approval distinctly',()=>{
  const v=view(empty());
  assert.equal(v.intelligence.impact.coveragePercent,null);
  assert.match(v.message,/Define mandatory requirements/);
  const r=pass(cmd(empty(),'addRequirement',{title:'Mandatory requirement'}));
  assert.match(view(r).message,/initial explicit approval/);
});
test('Overview intelligence does not count an untrusted selected approval as approved',()=>{
  const r=fresh();r.evidence.push(structuredClone(r.evidence[0]));
  const v=view(r);assert.equal(v.intelligence.kind,'unavailable');
  assert.equal(v.intelligence.impact,null);assert.equal(v.intelligence.plan.minimumActions,null);
  const rows=buildReviewRows(r,summarize(r),[{issueKey:'OTHER-1',summary:'Other',status:'approved',covered:1,mandatory:1}]);
  const projected=projectOverviewRows(rows,r.issueKey,v.intelligence);
  assert.equal(projected.find(x=>x.issueKey===r.issueKey).status,'inspection-required');
  assert.equal(overviewMetrics(projected).approved,1);
  assert.equal(filterReviewRows(projected,'','inspection-required').length,1);
  assert.equal(rows.find(x=>x.issueKey===r.issueKey).status,'approved');
});
test('Overview intelligence refreshes on a new revision',()=>{
  const r=exampleReview(), next=pass(r);
  assert.equal(view(r).intelligence.plan.minimumActions,2);
  assert.equal(view(next).intelligence.revision,r.revision+1);
  assert.equal(view(next).intelligence.plan.minimumActions,1);
});
test('Overview source consumes the projection and gates selected coverage and diagnostic',()=>{
  const source=readFileSync(new URL('../src/features/overview/OverviewPage.tsx',import.meta.url),'utf8');
  assert.match(source,/buildOverviewIntelligence\(review\), \[review\]/);
  assert.match(source,/projectOverviewRows\(buildReviewRows/);
  assert.match(source,/intelligence.kind === 'unavailable' \? <div/);
  assert.match(source,/item.status === 'inspection-required' \? 'Unavailable'/);
  assert.match(source,/const nextRequirement = available \?/);
  assert.doesNotMatch(source,/One or more requirements need current evidence\./);
  assert.doesNotMatch(source,/applyCommand|planRevalidation\(|analyzeReviewImpact\(/);
});
