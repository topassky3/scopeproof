import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';
import { analyzeReviewImpact as analyze } from '../src/change-impact.js';

const create = () => blankReview({id:'test',key:'TEST-1',summary:'Impact test',projectId:'test',projectKey:'TEST'});
const cmd = (r,type,fields={}) => applyCommand(r,{type,expectedRevision:r.revision,...fields},'test-actor');
const add = (r,title,mandatory=true) => cmd(r,'addRequirement',{title,mandatory});
const evidence = (r,requirementId,result='passed') => cmd(r,'addEvidence',{requirementId,title:'Test evidence',result});
const change = (r,requirementId) => cmd(r,'publishVersion',{requirementId,title:'Changed requirement title'});
const approve = r => cmd(r,'approve');
const approved = () => approve(evidence(evidence(add(add(create(),'Required one'),'Required two'),'RQ-01'),'RQ-02'));
const row = (a,id) => a.requirements.find(r=>r.requirementId===id);

function checkStatus(review, result) {
  const s = summarize(review);
  assert.equal(result.status,s.status);
  assert.equal(result.activeRevalidation,s.status==='revalidation');
  assert.equal(result.covered,s.covered);
  assert.equal(result.mandatory,s.mandatory);
}

test('Impact: approved snapshot is matched without active causes',()=>{
  const r=approved(), a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.status,'approved');
  assert.equal(a.coveragePercent,100);
  assert.deepEqual(a.reviewReasons,[]);
  assert.ok(a.requirements.every(x=>x.snapshotRelation==='matching' && !x.reasons.length));
});
test('Impact: version change explains stale evidence and preserves unaffected row',()=>{
  const r=change(approved(),'RQ-01'), a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.coveragePercent,50);
  assert.deepEqual(row(a,'RQ-01').reasons,['REQUIREMENT_VERSION_CHANGED','EVIDENCE_MISSING']);
  assert.equal(row(a,'RQ-01').previousVersion,1);
  assert.equal(row(a,'RQ-01').version,2);
  assert.equal(row(a,'RQ-02').snapshotRelation,'matching');
});
test('Impact: failed replacement reports both evidence facts',()=>{
  const r=evidence(approved(),'RQ-02','failed'), a=analyze(r);
  checkStatus(r,a);
  assert.equal(row(a,'RQ-02').state,'failed');
  assert.deepEqual(row(a,'RQ-02').reasons,['EVIDENCE_SUPERSEDED','EVIDENCE_FAILED']);
  assert.equal(row(a,'RQ-02').previousEvidenceId,'EV-102');
  assert.equal(row(a,'RQ-02').evidenceId,'EV-103');
});
test('Impact: passing replacement can invalidate an approval at full coverage',()=>{
  const r=evidence(approved(),'RQ-01'), a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.coveragePercent,100);
  assert.deepEqual(row(a,'RQ-01').reasons,['EVIDENCE_SUPERSEDED']);
  assert.deepEqual(a.reviewReasons,['FRESH_APPROVAL_REQUIRED']);
});
test('Impact: uncaptured mandatory scope is not guessed to be historically added',()=>{
  const r=add(approved(),'Additional requirement'), a=analyze(r);
  checkStatus(r,a);
  assert.deepEqual(row(a,'RQ-03').reasons,['MANDATORY_SCOPE_NOT_IN_SNAPSHOT','EVIDENCE_MISSING']);
  assert.equal(row(a,'RQ-03').previousVersion,null);
});
test('Impact: optional scope and optional changes do not become mandatory causes',()=>{
  let r=add(approved(),'Optional requirement',false);
  r=change(evidence(r,'RQ-03','failed'),'RQ-03');
  const a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.status,'approved');
  assert.equal(a.optionalCount,1);
  assert.equal(a.requirements.length,2);
  assert.deepEqual(a.reviewReasons,[]);
  assert.ok(a.requirements.every(x=>!x.reasons.length));
});
test('Impact: malformed snapshots never fabricate individual historical relations',()=>{
  for(const snapshot of [null,undefined,{},[],Array(2),[null,null], [{requirementId:'RQ-01',version:1,evidenceId:'EV-101'},{requirementId:'RQ-01',version:1,evidenceId:'EV-101'}]]){
    const r=approved(); r.approvals.at(-1).snapshot=snapshot;
    const a=analyze(r);
    checkStatus(r,a);
    assert.ok(a.reviewReasons.includes('SNAPSHOT_INVALID'));
    assert.ok(a.requirements.every(x=>x.snapshotRelation==='unavailable' && x.previousEvidenceId===null && !x.reasons.length));
  }
});
test('Impact: snapshot with unexpected scope reports mismatch without assuming history',()=>{
  const r=approved(); r.approvals.at(-1).snapshot[1].requirementId='UNKNOWN';
  const a=analyze(r);
  checkStatus(r,a);
  assert.ok(a.reviewReasons.includes('SNAPSHOT_SCOPE_MISMATCH'));
  assert.deepEqual(row(a,'RQ-02').reasons,['MANDATORY_SCOPE_NOT_IN_SNAPSHOT']);
});
test('Impact: full coverage after version change still needs a decision; reapproval clears causes',()=>{
  const r=evidence(change(approved(),'RQ-01'),'RQ-01');
  const a=analyze(r);
  checkStatus(r,a);
  assert.deepEqual(row(a,'RQ-01').reasons,['REQUIREMENT_VERSION_CHANGED']);
  assert.deepEqual(a.reviewReasons,['FRESH_APPROVAL_REQUIRED']);
  const fresh=approve(r), b=analyze(fresh);
  checkStatus(fresh,b);
  assert.equal(b.status,'approved');
  assert.deepEqual(b.reviewReasons,[]);
  assert.ok(b.requirements.every(x=>!x.reasons.length));
  assert.deepEqual(fresh.approvals[0],r.approvals[0]);
});
test('Impact: latest rejection is not treated as an active historical approval',()=>{
  const r=cmd(change(approved(),'RQ-01'),'reject',{note:'Needs review'}), a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.status,'rejected');
  assert.ok(a.requirements.every(x=>x.snapshotRelation==='not-applicable'));
  assert.deepEqual(row(a,'RQ-01').reasons,['EVIDENCE_MISSING']);
  assert.deepEqual(a.reviewReasons,[]);
});
test('Impact: empty, optional-only and never-approved reviews preserve domain states',()=>{
  for(const r of [create(),add(create(),'Optional requirement',false)]){
    const a=analyze(r); checkStatus(r,a);
    assert.equal(a.coveragePercent,null);
    assert.deepEqual(a.reviewReasons,['NO_MANDATORY_REQUIREMENTS']);
    assert.deepEqual(a.requirements,[]);
  }
  const r=add(create(),'Required one'), a=analyze(r);
  checkStatus(r,a);
  assert.equal(a.status,'in-review');
  assert.deepEqual(row(a,'RQ-01').reasons,['EVIDENCE_MISSING']);
  assert.equal(row(a,'RQ-01').snapshotRelation,'not-applicable');
});
test('Impact: simultaneous changes are deterministic, complete and read-only',()=>{
  let r=change(approved(),'RQ-01'); r=evidence(r,'RQ-02','failed'); r=add(r,'Additional requirement');
  const original=structuredClone(r), a=analyze(r);
  checkStatus(r,a);
  assert.deepEqual(a,analyze(r));
  assert.deepEqual(r,original);
  assert.equal(a.requirements.length,3);
  assert.ok(a.requirements.every(x=>x.reasons.length>0));
});

test('Impact: unknown historical evidence reference is not described as a verified replacement',()=>{
  const r=approved(); r.approvals.at(-1).snapshot[0].evidenceId='UNKNOWN';
  const a=analyze(r); checkStatus(r,a);
  assert.equal(a.status,'revalidation');
  assert.deepEqual(row(a,'RQ-01').reasons,['SNAPSHOT_EVIDENCE_UNVERIFIED']);
  assert.ok(a.reviewReasons.includes('FRESH_APPROVAL_REQUIRED'));
});
