import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize, exampleReview } from '../src/domain.js';
const empty = () => blankReview({id:'1',key:'AC-1',summary:'Test',projectId:'10',projectKey:'AC'});
const run = (r,type,props={}) => applyCommand(r,{type,expectedRevision:r.revision,...props},'tester');

test('version change stales evidence and requires revalidation', () => {
  const r = exampleReview(); const s = summarize(r);
  assert.equal(s.status, 'revalidation');
  assert.equal(s.covered, 2);
  assert.equal(s.mandatory, 3);
  assert.equal(s.rows[0].state, 'stale');
  assert.equal(r.approvals.at(-1).type,'approved');
});
test('blocks approval without current passing evidence', () => {
  const r = run(empty(),'addRequirement',{title:'Require MFA login'});
  assert.throws(()=>run(r,'approve'),/APPROVAL_BLOCKED/);
});
test('can reapprove with new passing evidence and immutable history', () => {
  let r = exampleReview();
  r = run(r,'addEvidence',{requirementId:'RQ-01',title:'MFA integration test',result:'passed'});
  assert.equal(summarize(r).status,'revalidation');
  r = run(r,'approve',{note:'New evidence validated'});
  assert.equal(summarize(r).status,'approved');
  assert.equal(r.approvals.length, 2);
  assert.equal(r.requirements[0].versions.length, 2);
});
test('failed latest evidence blocks approval', () => {
  let r=run(empty(),'addRequirement',{title:'Verify login flow'});
  r=run(r,'addEvidence',{requirementId:'RQ-01',title:'Pass first',result:'passed'});
  r=run(r,'addEvidence',{requirementId:'RQ-01',title:'Fail now',result:'failed'});
  assert.equal(summarize(r).rows[0].state,'failed');
  assert.throws(()=>run(r,'approve'),/APPROVAL_BLOCKED/);
});
test('requires revision match, even when commands are otherwise valid', () => {
  const r=run(empty(),'addRequirement',{title:'Require secure login'});
  assert.throws(()=>applyCommand(r,{type:'addRequirement',expectedRevision:0,title:'Late version'},'tester'),/CONFLICT/);
});
test('reject preserves a reason', () => {
  const r=run(empty(),'reject',{note:'Needs additional testing'});
  assert.equal(r.approvals[0].type,'rejected');
  assert.equal(summarize(r).status,'rejected');
});
test('invalid evidence URL rejected', () => {
  const r=run(empty(),'addRequirement',{title:'Verify login flow'});
  assert.throws(()=>run(r,'addEvidence',{requirementId:'RQ-01',title:'Test',result:'passed',url:'javascript:alert(1)'}),/HTTPS/);
});
