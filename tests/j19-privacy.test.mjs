import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';
import { actorInventory, redactActorReferences, ERASED_ACTOR } from '../src/privacy/review-data.js';
import { inventoryStorage, reportInventory, applyClosedAccounts } from '../src/privacy/cycle.js';
import { createPrivacyInventoryAdapter } from '../src/privacy/forge-storage.js';
import { eventDetail } from '../src/features/history/history-model.mjs';
import { actorLabel, collectActorIds } from '../src/shared/actors/actor-names.mjs';

const A='synthetic:alpha', B='synthetic:beta';
const mk=(id='1')=>{
  let r=blankReview({id,key:'QA-'+id,summary:'Synthetic',projectId:'1',projectKey:'QA'});
  r=applyCommand(r,{type:'addRequirement',title:'Mandatory requirement',expectedRevision:r.revision},A);
  r=applyCommand(r,{type:'addEvidence',requirementId:'RQ-01',title:'Synthetic evidence',result:'passed',expectedRevision:r.revision},B);
  r=applyCommand(r,{type:'approve',expectedRevision:r.revision},A);
  r.events[0].createdAt='2020-01-01T00:00:00.000Z';
  return r;
};
const mock=()=>{
  const store={ces:new Map([['review:1',{review:mk()}]]),legacy:new Map([['review:1',{review:mk()}],['review:2',{review:mk('2')} ]])};
  let writes=0, conflict=false;
  return {store,get writes(){return writes},setConflict(){conflict=true},exclusiveMaintenance:true,
    async listPage(s,c){const keys=[...store[s].keys()];return c?{keys:keys.slice(1)}:{keys:keys.slice(0,1),nextCursor:keys.length>1?'next':undefined}},
    async read(s,k){return structuredClone(store[s].get(k))},
    async replaceIfRevision(s,k,old,next){if(conflict||store[s].get(k).review.revision!==old.review.revision)return false;store[s].set(k,{review:structuredClone(next)});writes++;return true;}
  }
};
test('Privacy: inventory contains all four actor paths and oldest age',()=>{
  const a=actorInventory(mk());assert.equal(a.size,2);assert.equal(a.get(A),'2020-01-01T00:00:00.000Z');assert.ok(a.has(B));
});
test('Privacy: invalid age and invalid actor fail instead of silently omitting',()=>{
  const r=mk();r.events[0].createdAt='invalid';assert.throws(()=>actorInventory(r),/UNKNOWN_DATA_AGE/);
  const s=mk();s.events[0].actor='unclassified actor';assert.throws(()=>actorInventory(s),/UNCLASSIFIED_ACTOR/);
});
test('Privacy: erase attribution without changing approval semantics',()=>{
  const r=mk(),original=structuredClone(r),next=redactActorReferences(r,[A]);
  assert.deepEqual(r,original);assert.ok(next.removed>0);assert.equal(next.review.revision,r.revision+1);
  assert.equal(summarize(next.review).status,'approved');
  assert.deepEqual(next.review.approvals[0].snapshot,r.approvals[0].snapshot);
  assert.deepEqual(next.review.evidence,r.evidence);
  assert.ok(next.review.approvals[0].actor.startsWith(ERASED_ACTOR));
  assert.ok(!actorInventory(next.review).has(A));assert.ok(actorInventory(next.review).has(B));
  assert.equal(redactActorReferences(next.review,[A]).removed,0);
});
test('Privacy: scan paginates legacy and CES copies separately and deduplicates identities',async()=>{
  const m=mock(),i=await inventoryStorage(m);assert.equal(i.records.length,3);assert.equal(i.accounts.length,2);assert.equal(m.writes,0);
});
test('Privacy: repeated cursor, budget or wrong key fails closed',async()=>{
  const m=mock();await assert.rejects(inventoryStorage(m,{maxPages:1}),/PAGE_BUDGET/);
  await assert.rejects(inventoryStorage({...m,listPage:async()=>({keys:[],nextCursor:'loop'})}),/CURSOR_INVALID/);
  await assert.rejects(inventoryStorage({...m,listPage:async()=>({keys:['bad']})}),/UNCLASSIFIED_KEY/);
});
test('Privacy: report batch size, active/updated/closed and duplicate input',async()=>{
  const accounts=Array.from({length:91},(_,i)=>({accountId:'synthetic:'+i,updatedAt:'2020-01-01T00:00:00.000Z'}));const lengths=[];
  const actions=await reportInventory(accounts,async rows=>{lengths.push(rows.length);return rows.length===90?[{accountId:rows[0].accountId,status:'closed'},{accountId:rows[1].accountId,status:'updated'}]:[]});
  assert.deepEqual(lengths,[90,1]);assert.deepEqual(actions.map(a=>a.status),['closed','updated']);
  await assert.rejects(reportInventory([accounts[0],accounts[0]],async()=>[]),/INVALID_REPORT/);
});
test('Privacy: foreign, duplicate and invalid report responses rejected; no writes',async()=>{
  const m=mock(),{accounts}=await inventoryStorage(m);
  for(const result of [[{accountId:'foreign',status:'closed'}],[{accountId:A,status:'wrong'}],[{accountId:A,status:'closed'},{accountId:A,status:'closed'}],null])
    await assert.rejects(reportInventory(accounts,async()=>result),/INVALID_REPORT_RESPONSE/);
  await assert.rejects(reportInventory(accounts,async()=>{throw Error('synthetic outage')}));
  assert.equal(m.writes,0);
});
test('Privacy: synthetic closed redaction affects both copies, updated stays for review',async()=>{
  const m=mock(),i=await inventoryStorage(m);
  const r=await applyClosedAccounts(m,[{accountId:A,status:'closed'},{accountId:B,status:'updated'}],i.records);
  assert.equal(r.changed,3);assert.equal(r.updatesRequiringReview,1);
  for(const s of ['ces','legacy']) for(const {review} of m.store[s].values()){
    assert.ok(!actorInventory(review).has(A));assert.ok(actorInventory(review).has(B));assert.equal(summarize(review).status,'approved');
  }
  assert.equal((await applyClosedAccounts(m,[{accountId:A,status:'closed'}],i.records)).changed,0);
});
test('Privacy: no unauthorized write and concurrent conflict not overwritten',async()=>{
  const m=mock(),i=await inventoryStorage(m),actions=[{accountId:A,status:'closed'}];
  await assert.rejects(applyClosedAccounts({...m,exclusiveMaintenance:false},actions,i.records),/MAINTENANCE_REQUIRED/);
  m.setConflict();await assert.rejects(applyClosedAccounts(m,actions,i.records),/WRITE_CONFLICT/);assert.equal(m.writes,0);
});
test('Privacy: separate installation adapters never cross-read',async()=>{
  const a=mock(),b=mock(),i=await inventoryStorage(a);
  await applyClosedAccounts(a,[{accountId:A,status:'closed'}],i.records);
  assert.equal(b.writes,0);assert.ok(actorInventory(b.store.ces.get('review:1').review).has(A));
});
test('Privacy: Forge inventory adapter queries by-key, rereads and rejects malformed wrappers',async()=>{
  const r=mk(),calls=[];
  const q={index(...x){calls.push(x);return this},where(...x){calls.push(x);return this},limit(){return this},cursor(){return this},async getMany(){return {results:[{key:'review:1'}]}}};
  const io=createPrivacyInventoryAdapter({kvs:{entity:()=>({query:()=>q,get:async()=>({review:r,revision:'wrong'})}),query:()=>q,get:async()=>r},WhereConditions:{beginsWith:x=>x}});
  assert.deepEqual(await io.listPage('ces'),{keys:['review:1'],nextCursor:undefined});
  assert.deepEqual(await io.listPage('legacy'),{keys:['review:1'],nextCursor:undefined});
  assert.ok(calls.some(x=>x[0]==='by-key'));await assert.rejects(io.read('ces','review:1'),/INVALID_WRAPPER/);
  assert.deepEqual(await io.read('legacy','review:1'),{review:r});
});

test('Privacy: opaque per-operation marker preserves previously verified decision links',()=>{
  const r=mk(),e=r.events.find(e=>e.type==='review-approved'),before=eventDetail(r,e);
  assert.equal(before.kind,'decision');
  const result=redactActorReferences(r,[A]).review,after=result.events.find(item=>item.id===e.id);
  assert.deepEqual(eventDetail(result,after),before);
  assert.equal(actorLabel(after.actor),'Actor erased');
  assert.ok(!collectActorIds(result).includes(after.actor));
  assert.ok(!actorInventory(result).has(after.actor));
  assert.equal(after.actor,result.approvals[0].actor);
});
test('Privacy: erased ambiguous history never acquires a false attribution',()=>{
  const r=mk();const e=r.events.find(e=>e.type==='review-approved');r.events.push({...e,id:'duplicate-event'});
  assert.equal(eventDetail(r,e).kind,'unavailable');
  const n=redactActorReferences(r,[A]).review;
  for(const item of n.events.filter(x=>x.type==='review-approved')) {
    assert.equal(item.actor,ERASED_ACTOR);assert.equal(eventDetail(n,item).kind,'unavailable');
  }
  assert.equal(summarize(n).status,'approved');
});
test('Privacy: conflicting duplicate actions fail before any mutation',async()=>{
  const m=mock(),i=await inventoryStorage(m);
  await assert.rejects(applyClosedAccounts(m,[{accountId:A,status:'closed'},{accountId:A,status:'updated'}],i.records),/DUPLICATE_ACTION/);
  assert.equal(m.writes,0);
});
