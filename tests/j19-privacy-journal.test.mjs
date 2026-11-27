import test from 'node:test';
import assert from 'node:assert/strict';
import { newBatch,advanceBatch } from '../src/privacy/journal.js';
import { fixtureAllowed,runFixture,ACTIVE,CLOSED } from '../src/privacy/fixture.js';
import { JOB_ENTITY,FIXTURE_JOB_KEY } from '../src/privacy/forge-journal.js';
const accounts=[{accountId:'synthetic:a',updatedAt:'2020-01-01T00:00:00.000Z'},{accountId:'synthetic:b',updatedAt:'2020-01-01T00:00:00.000Z'}];
const now=10000, cycleMs=7*86400000;
const mem=()=>{
 let row={revision:0,payload:newBatch(accounts,now)};
 return {async read(){return structuredClone(row)},async compareAndSet(old,payload){if(old.revision!==row.revision)return false;row={revision:row.revision+1,payload:structuredClone(payload)};return true;}};
};
const closed={accountId:accounts[0].accountId,status:'closed'},updated={accountId:accounts[1].accountId,status:'updated'};
const success=actions=>({kind:'success',actions,cycleMs});
test('Privacy journal: persists report and distinct actions across invocations',async()=>{
 const io=mem(),seen=[];let calls=0;
 const deps={now,report:async()=>{calls++;return success([closed,updated]);},remediate:async x=>{seen.push(x);return true;}};
 assert.equal((await advanceBatch(io,deps)).status,'pending');
 assert.equal((await advanceBatch(io,deps)).status,'pending');
 assert.equal((await advanceBatch(io,deps)).status,'complete');
 assert.deepEqual(await advanceBatch(io,deps),{status:'complete',closed:1,updated:1,remediated:2});
 assert.equal(calls,1);assert.deepEqual(seen,[closed,updated]);
 const p=(await io.read()).payload;assert.deepEqual(p.accounts,[]);assert.deepEqual(p.actions,[]);assert.equal(p.nextEligibleAt,now+cycleMs);
});
test('Privacy journal: duplicate scheduled invocations send at most once',async()=>{
 const io=mem();let calls=0;const deps={now,report:async()=>{calls++;return success([])},remediate:async()=>true};
 await Promise.all([advanceBatch(io,deps),advanceBatch(io,deps),advanceBatch(io,deps)]);
 assert.equal(calls,1);assert.equal((await io.read()).payload.phase,'complete');
});
test('Privacy journal: unknown report outcome is held, never blindly repeated',async()=>{
 const io=mem();let calls=0;const deps={now,report:async()=>{calls++;throw Error('lost response')},remediate:async()=>true};
 assert.equal((await advanceBatch(io,deps)).status,'held');assert.equal((await advanceBatch(io,deps)).status,'held');assert.equal(calls,1);
});
test('Privacy journal: known rate rejection respects retry deadline',async()=>{
 const io=mem();let calls=0;
 const deps={now,report:async()=>{calls++;return calls===1?{kind:'retry',retryAfterMs:10000}:success([])},remediate:async()=>true};
 assert.equal((await advanceBatch(io,deps)).status,'waiting');assert.equal((await advanceBatch(io,{...deps,now:19999})).status,'waiting');
 assert.equal((await advanceBatch(io,{...deps,now:20000})).status,'complete');assert.equal(calls,2);
});
test('Privacy journal: real cycle metadata missing fails closed',async()=>{
 const io=mem();const deps={now,report:async()=>({kind:'success',actions:[],cycleMs:null}),remediate:async()=>true};
 assert.equal((await advanceBatch(io,deps)).status,'held');assert.equal((await io.read()).payload.phase,'sending');
});
test('Privacy journal: foreign response is held without remediation',async()=>{
 const io=mem();let writes=0;
 const deps={now,report:async()=>success([{accountId:'foreign',status:'closed'}]),remediate:async()=>{writes++;return true}};
 assert.equal((await advanceBatch(io,deps)).status,'held');assert.equal(writes,0);
});
test('Privacy journal: interrupted remediation is held and no false acknowledgement',async()=>{
 const io=mem();let writes=0;
 const deps={now,report:async()=>success([closed]),remediate:async()=>{writes++;throw Error('interrupted')}};
 await advanceBatch(io,deps);assert.equal((await advanceBatch(io,deps)).status,'held');assert.equal((await advanceBatch(io,deps)).status,'held');
 assert.equal(writes,1);assert.equal((await io.read()).payload.remediated,0);
});
test('Privacy journal: invalid initial batches refused',()=>{
 for(const rows of [[],[accounts[0],accounts[0]],[{...accounts[0],updatedAt:'bad'}]])assert.throws(()=>newBatch(rows,now),/BATCH_INVALID/);
});
const env={SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION:'synthetic-installation'};
const context={environmentType:'DEVELOPMENT',installationAri:'synthetic-installation'};
test('Privacy fixture: platform development and exact installation required',()=>{
 assert.equal(fixtureAllowed(context,env),true);
 for(const c of [{...context,environmentType:'PRODUCTION'},{...context,installationAri:'other'},{}])assert.equal(fixtureAllowed(c,env),false);
 assert.equal(fixtureAllowed(context,{}),false);
});
function forgeMock(){
 const data=new Map(),legacy=new Map(),calls=[];
 class Filter{constructor(){this.values=[]}and(k,v){this.values.push([k,v]);return this}}
 const entity={
  async get(k){return structuredClone(data.get(k))},
  async set(k,v,o){if(o?.keyPolicy==='FAIL_IF_EXISTS'&&data.has(k))throw Error('exists');data.set(k,structuredClone(v));},
  async delete(k){data.delete(k)}
 };
 const kvs={entity(n){assert.equal(n,JOB_ENTITY);return entity;},async get(k){assert.ok(k.startsWith('privacy-fixture:'));return structuredClone(legacy.get(k));},
 async set(k,v){assert.ok(k.startsWith('privacy-fixture:'));legacy.set(k,structuredClone(v))},async delete(k){legacy.delete(k)},
 transact(){return {set(k,v,o){return {async execute(){const cur=data.get(k);if(!o.conditions.values.every(([x,y])=>cur?.[x]===y))throw Error('conflict');data.set(k,structuredClone(v));}}}}}};
 const deps={kvs,Filter,FilterConditions:{equalTo:x=>x},privacy:{async reportPersonalData(rows){calls.push(rows);return [{accountId:CLOSED,status:'closed'}]}}};
 return {data,legacy,calls,deps};
}
test('Privacy fixture: actual handler dependencies exercise isolated CES and KVS, once',async()=>{
 const m=forgeMock();
 assert.equal((await runFixture(m.deps,{...context,environmentType:'PRODUCTION'},env,now)).status,'disabled');assert.equal(m.data.size,0);
 assert.equal((await runFixture(m.deps,context,env,now)).status,'pending');
 assert.equal((await runFixture(m.deps,context,env,now)).status,'complete');
 assert.deepEqual(await runFixture(m.deps,context,env,now),{status:'complete',closed:1,updated:0,remediated:1});
 assert.equal(m.calls.length,1);assert.deepEqual(m.calls[0].map(x=>x.accountId),[ACTIVE,CLOSED]);
 assert.deepEqual([...m.data.keys()],[FIXTURE_JOB_KEY]);assert.equal(m.legacy.size,0);
 assert.equal(m.data.get(FIXTURE_JOB_KEY).payload.accounts.length,0);
});
test('Privacy fixture: unexpected API response blocks without touching fixture records',async()=>{
 const m=forgeMock();m.deps.privacy.reportPersonalData=async()=>[{accountId:'foreign',status:'closed'}];
 assert.equal((await runFixture(m.deps,context,env,now)).status,'held');assert.equal(m.data.size,1);assert.equal(m.legacy.size,0);
});
test('Privacy fixture: separate installation stores never share journal or report',async()=>{
 const a=forgeMock(),b=forgeMock();await runFixture(a.deps,context,env,now);
 assert.equal(b.data.size,0);assert.equal(b.calls.length,0);
});
