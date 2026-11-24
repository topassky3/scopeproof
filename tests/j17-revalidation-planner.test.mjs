import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';
import { planRevalidation as plan } from '../src/revalidation-planner.js';

const create = () => blankReview({id:'test',key:'TEST-1',summary:'Planner test',projectId:'test',projectKey:'TEST'});
const cmd = (r,type,fields={}) => applyCommand(r,{type,expectedRevision:r.revision,...fields},'test-actor');
const add = (r,title,mandatory=true) => cmd(r,'addRequirement',{title,mandatory});
const ev = (r,requirementId,result='passed') => cmd(r,'addEvidence',{requirementId,title:'Synthetic passing or failing test',result});
const change = (r,requirementId) => cmd(r,'publishVersion',{requirementId,title:'Changed requirement title'});
const approved = (n=2) => {
  let r=create();
  for(let i=1;i<=n;i++) r=add(r,`Required ${i}`);
  for(const req of r.requirements) r=ev(r,req.id);
  return cmd(r,'approve');
};
// Synthetic replay ONLY: assume evidence collection really succeeded and an authorized human approves.
function replay(r,p) {
  for(const a of p.actions) {
    if(a.type==='obtain-passing-evidence') r=ev(r,a.requirementId);
    else if(a.type==='request-explicit-approval') r=cmd(r,'approve');
    else assert.fail('Unknown advisory action');
  }
  return r;
}
const inspect = (r,code) => {
  const p=plan(r);
  assert.equal(p.disposition,'inspect-records');
  assert.equal(p.minimumActions,null);
  assert.deepEqual(p.actions,[]);
  assert.ok(p.issues.includes(code));
};

test('Planner: approved review needs no actions and retains current evidence',()=>{
  const r=approved(), p=plan(r);
  assert.equal(p.status,'approved'); assert.equal(p.disposition,'no-action');
  assert.equal(p.minimumActions,0); assert.deepEqual(p.actions,[]);
  assert.equal(p.retainedEvidence.length,2); assert.equal(p.revision,r.revision);
});
test('Planner: changed mandatory version needs one evidence and one explicit approval',()=>{
  const r=change(approved(),'RQ-01'),p=plan(r);
  assert.equal(p.disposition,'revalidate'); assert.equal(p.minimumActions,2);
  assert.deepEqual(p.actions.map(a=>a.type),['obtain-passing-evidence','request-explicit-approval']);
  assert.equal(p.actions[0].requirementId,'RQ-01'); assert.equal(p.actions[0].version,2);
  assert.equal(p.retainedEvidence[0].requirementId,'RQ-02');
  assert.equal(summarize(replay(r,p)).status,'approved');
});
test('Planner: failed mandatory evidence is renewed, other passing evidence is retained',()=>{
  const r=ev(approved(),'RQ-02','failed'),p=plan(r);
  assert.equal(p.minimumActions,2); assert.equal(p.actions[0].requirementId,'RQ-02');
  assert.ok(p.actions[0].reasons.includes('EVIDENCE_FAILED'));
  assert.equal(summarize(replay(r,p)).status,'approved');
});
test('Planner: replacement passing evidence needs only explicit approval',()=>{
  const r=ev(approved(),'RQ-01'),p=plan(r);
  assert.equal(p.minimumActions,1); assert.equal(p.retainedEvidence.length,2);
  assert.equal(p.retainedEvidence[0].snapshotRelation,'evidence-changed');
  assert.equal(summarize(replay(r,p)).status,'approved');
});
test('Planner: recovered coverage still needs a fresh decision',()=>{
  const r=ev(change(approved(),'RQ-01'),'RQ-01'),p=plan(r);
  assert.equal(p.minimumActions,1); assert.equal(p.actions[0].type,'request-explicit-approval');
  assert.equal(summarize(replay(r,p)).status,'approved');
});
test('Planner: newly uncaptured scope has its own evidence action',()=>{
  const r=add(approved(),'Additional mandatory requirement'),p=plan(r);
  assert.equal(p.minimumActions,2); assert.equal(p.actions[0].requirementId,'RQ-03');
  assert.equal(summarize(replay(r,p)).status,'approved');
});
test('Planner: optional changes do not introduce mandatory work',()=>{
  let r=add(approved(),'Optional requirement',false); r=ev(r,'RQ-03','failed');
  assert.equal(plan(r).minimumActions,0);
  r=change(r,'RQ-01'); assert.equal(plan(r).minimumActions,2);
  assert.ok(plan(r).actions.every(a=>a.requirementId!=='RQ-03'));
});
test('Planner: first approval is distinct from revalidation',()=>{
  let r=add(create(),'Required one');
  assert.equal(plan(r).disposition,'initial-approval'); assert.equal(plan(r).minimumActions,2);
  r=ev(r,'RQ-01'); assert.equal(plan(r).status,'ready'); assert.equal(plan(r).minimumActions,1);
  assert.equal(summarize(replay(r,plan(r))).status,'approved');
});
test('Planner: empty and optional-only reviews require scope definition',()=>{
  for(const r of [create(),add(create(),'Optional requirement',false)]) {
    const p=plan(r); assert.equal(p.disposition,'define-mandatory-scope');
    assert.equal(p.minimumActions,null); assert.deepEqual(p.actions,[]);
  }
});
test('Planner: explicit rejection requires human review even with complete coverage',()=>{
  const r=cmd(approved(),'reject',{note:'Human decision'}),p=plan(r);
  assert.equal(p.status,'rejected'); assert.equal(p.disposition,'human-review');
  assert.equal(p.minimumActions,null); assert.deepEqual(p.actions,[]);
});
test('Planner: malformed or duplicate snapshot prevents automatic recovery advice',()=>{
  for(const snapshot of [null,[],[null],Array(2),[{}]]) {
    const r=approved(); r.approvals.at(-1).snapshot=snapshot; inspect(r,'SNAPSHOT_INVALID');
  }
  const r=approved(); r.approvals.at(-1).snapshot[1]=structuredClone(r.approvals.at(-1).snapshot[0]);
  inspect(r,'SNAPSHOT_INVALID');
});
test('Planner: ambiguous requirement or evidence ids stop planning',()=>{
  let r=approved(); r.requirements.push(structuredClone(r.requirements[0])); inspect(r,'AMBIGUOUS_REQUIREMENT_ID');
  r=approved(); r.evidence.push(structuredClone(r.evidence[0])); inspect(r,'AMBIGUOUS_EVIDENCE_ID');
});
test('Planner: inconsistent snapshot references and future versions stop planning',()=>{
  let r=approved(); r.approvals.at(-1).snapshot[0].evidenceId='UNKNOWN'; inspect(r,'SNAPSHOT_EVIDENCE_UNVERIFIED');
  r=approved(); r.approvals.at(-1).snapshot[0].version=2; inspect(r,'SNAPSHOT_SCOPE_OR_VERSION_INCONSISTENT');
  r=approved(); r.evidence[0].version=2; inspect(r,'INVALID_EVIDENCE_REFERENCE');
});
test('Planner: malformed input and identifier allocation collision stop planning',()=>{
  inspect(null,'INVALID_REVIEW_STRUCTURE'); inspect({...create(),evidence:null},'INVALID_REVIEW_STRUCTURE');
  let r=add(add(create(),'Required one'),'Required two'); r=ev(r,'RQ-01'); r.evidence[0].id='EV-102';
  inspect(r,'EVIDENCE_ID_ALLOCATION_COLLISION');
});
test('Planner: all 27 combinations of unchanged, stale and failed evidence are sufficient and minimal under fixed scope',()=>{
  for(let mask=0;mask<27;mask++) {
    let r=approved(3), digits=mask, blockers=0;
    for(const req of r.requirements) {
      const mode=digits%3; digits=Math.floor(digits/3);
      if(mode===1) {r=change(r,req.id); blockers++;}
      if(mode===2) {r=ev(r,req.id,'failed'); blockers++;}
    }
    const original=structuredClone(r), p=plan(r);
    assert.deepEqual(p,plan(r)); assert.deepEqual(r,original);
    assert.equal(p.minimumActions,blockers===0?0:blockers+1);
    assert.equal(p.retainedEvidence.length,3-blockers);
    const final=replay(r,p); assert.equal(summarize(final).status,'approved');
    assert.deepEqual(final.approvals.slice(0,r.approvals.length),r.approvals);
    assert.deepEqual(final.evidence.slice(0,r.evidence.length),r.evidence);
    // Removing any single required action must not recover approval.
    for(let i=0;i<p.actions.length;i++) {
      const subset={...p,actions:p.actions.filter((_,j)=>i!==j)};
      let partial; try {partial=replay(r,subset);} catch(e) {assert.match(e.message,/APPROVAL_BLOCKED/); continue;}
      assert.notEqual(summarize(partial).status,'approved');
    }
  }
});
