import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, blankReview, exampleReview } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { requirementTrace, evidenceTrace } from '../src/shared/traceability-intelligence.js';
const run = (r, command) => applyCommand(r,{...command,expectedRevision:r.revision},'QA');
const pass = r => run(r,{type:'addEvidence',requirementId:'RQ-01',title:'Current passing test',result:'passed'});
const project = buildReviewIntelligence;

test('Traceability: changed mandatory requirement identifies the exact version and required action',()=>{
  const r=exampleReview(), before=structuredClone(r), i=project(r), t=requirementTrace(i,'RQ-01');
  assert.equal(t.impact.previousVersion,1); assert.equal(t.impact.version,2);
  assert.equal(t.requiresEvidence,true); assert.equal(t.retained,false);
  assert.ok(t.impact.reasons.includes('REQUIREMENT_VERSION_CHANGED'));
  assert.deepEqual(r,before);
});
test('Traceability: unchanged evidence is both retained and referenced by approved snapshot',()=>{
  const r=exampleReview(), i=project(r), e=r.evidence.find(e=>e.id==='EV-102');
  assert.deepEqual(evidenceTrace(i,e),{mandatory:true,retained:true,inLatestApprovedSnapshot:true});
});
test('Traceability: old passing evidence is historical and never retained for current coverage',()=>{
  const r=exampleReview(), i=project(r);
  assert.deepEqual(evidenceTrace(i,r.evidence[0]),{mandatory:true,retained:false,inLatestApprovedSnapshot:true});
});
test('Traceability: fresh passing evidence is retained before explicit reapproval',()=>{
  const r=pass(exampleReview()), i=project(r), e=r.evidence.at(-1);
  assert.equal(i.plan.minimumActions,1);
  assert.deepEqual(evidenceTrace(i,e),{mandatory:true,retained:true,inLatestApprovedSnapshot:false});
  assert.equal(requirementTrace(i,'RQ-01').requiresEvidence,false);
  const approved=run(r,{type:'approve'}), a=project(approved);
  assert.equal(a.plan.minimumActions,0);
  assert.deepEqual(evidenceTrace(a,e),{mandatory:true,retained:true,inLatestApprovedSnapshot:true});
});
test('Traceability: a same-version failure supersedes passing evidence',()=>{
  const r=run(exampleReview(),{type:'addEvidence',requirementId:'RQ-02',title:'Latest failure',result:'failed'}), i=project(r);
  assert.equal(requirementTrace(i,'RQ-02').requiresEvidence,true);
  assert.deepEqual(evidenceTrace(i,r.evidence.at(-1)),{mandatory:true,retained:false,inLatestApprovedSnapshot:false});
  assert.deepEqual(evidenceTrace(i,r.evidence.find(e=>e.id==='EV-102')),{mandatory:true,retained:false,inLatestApprovedSnapshot:true});
});
test('Traceability: optional evidence stays outside mandatory approval scope',()=>{
  let r=blankReview({id:'1',key:'T-1',summary:'Test',projectId:'2',projectKey:'T'});
  r=run(r,{type:'addRequirement',title:'Optional requirement',mandatory:false}); r=pass(r);
  const i=project(r);
  assert.equal(requirementTrace(i,'RQ-01'),null);
  assert.deepEqual(evidenceTrace(i,r.evidence[0]),{mandatory:false,retained:false,inLatestApprovedSnapshot:false});
});
test('Traceability: rejection does not fabricate retained evidence or current approval history',()=>{
  const r=run(pass(exampleReview()),{type:'reject',note:'Needs human review'}), i=project(r);
  assert.equal(i.plan.minimumActions,null);
  assert.equal(requirementTrace(i,'RQ-01').retained,false);
  assert.deepEqual(evidenceTrace(i,r.evidence.at(-1)),{mandatory:true,retained:false,inLatestApprovedSnapshot:false});
});
test('Traceability: ambiguous records suppress all diagnostic claims',()=>{
  const r=exampleReview(); r.evidence.push(structuredClone(r.evidence[0])); const i=project(r);
  assert.equal(i.kind,'unavailable'); assert.equal(requirementTrace(i,'RQ-01'),null); assert.equal(evidenceTrace(i,r.evidence[0]),null);
});
test('Traceability: exact record version and result must match before retention is attributed',()=>{
  const r=pass(exampleReview()), i=project(r), e=r.evidence.at(-1);
  for(const other of [{...e,version:1},{...e,result:'failed'},{...e,id:'EV-unknown'}]) assert.equal(evidenceTrace(i,other).retained,false);
});
