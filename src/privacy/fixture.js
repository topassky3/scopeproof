import { blankReview,applyCommand,summarize } from '../domain.js';
import { actorInventory,redactActorReferences } from './review-data.js';
import { advanceBatch,newBatch } from './journal.js';
import { JOB_ENTITY,createFixtureJournal } from './forge-journal.js';
import { sameRecordValue } from '../shared/record-equality.js';

export const ACTIVE='5be24ad8b1653240376955d2', CLOSED='5be24ba3f91c106033269289';
const ids=new Set([ACTIVE,CLOSED]);
const age='2020-01-01T00:00:00.000Z';
const accounts=[{accountId:ACTIVE,updatedAt:age},{accountId:CLOSED,updatedAt:age}];
const cesKey='privacy-fixture:v2:ces',legacyKey='privacy-fixture:v2:legacy';
export function fixtureAllowed(context,env) {
  return typeof context?.environmentType==='string'&&context.environmentType.toLowerCase()==='development'&&
    typeof env.SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION==='string'&&env.SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION.length>0&&
    context.installationAri===env.SCOPEPROOF_PRIVACY_FIXTURE_INSTALLATION;
}
function reviewFixture(){
  let r=blankReview({id:'900000001',key:'FIXTURE-1',summary:'Synthetic privacy test',projectId:'900000001',projectKey:'FIXTURE'});
  r=applyCommand(r,{type:'addRequirement',title:'Synthetic mandatory requirement',expectedRevision:r.revision},CLOSED);
  r=applyCommand(r,{type:'addEvidence',requirementId:'RQ-01',title:'Synthetic passing evidence',result:'passed',expectedRevision:r.revision},ACTIVE);
  return applyCommand(r,{type:'approve',expectedRevision:r.revision},CLOSED);
}
export function createFixtureRemediator({kvs}) {
  // No user-supplied IDs, keys, namespaces or review objects. The journal
  // claim serializes this fixture path; no normal resolver writes these keys.
  const ces=()=>kvs.entity(JOB_ENTITY);
  return async action=>{
    if(!ids.has(action?.accountId)||!['closed','updated'].includes(action.status))throw Error('PRIVACY_FIXTURE_TARGET');
    const r=reviewFixture(), next=redactActorReferences(r,[action.accountId]).review;
    if(summarize(next).status!=='approved'||actorInventory(next).has(action.accountId))throw Error('PRIVACY_FIXTURE_REDACTION');
    // Persist only the redacted synthetic result; verify both stores by
    // direct read and delete those fixed fixture artifacts after validation.
    const wrapped={revision:String(next.revision),token:'synthetic-fixture',payload:next};
    await ces().set(cesKey,wrapped);
    await kvs.set(legacyKey,next);
    if(!sameRecordValue(await ces().get(cesKey),wrapped)||!sameRecordValue(await kvs.get(legacyKey),next))throw Error('PRIVACY_FIXTURE_READBACK');
    await ces().delete(cesKey);
    await kvs.delete(legacyKey);
    if((await ces().get(cesKey))!=null||(await kvs.get(legacyKey))!=null)throw Error('PRIVACY_FIXTURE_CLEANUP');
    return true;
  };
}
export async function runFixture(deps,context,env,now=Date.now()){
  if(!fixtureAllowed(context,env))return {status:'disabled'};
  const io=createFixtureJournal(deps);
  if(!await io.read())await io.create(newBatch(accounts,now));
  return advanceBatch(io,{
    now,fixture:true,
    report:async rows=>{
      if(rows.length!==2||new Set(rows.map(r=>r.accountId)).size!==2||rows.some(r=>!ids.has(r.accountId)||r.updatedAt!==age))throw Error('PRIVACY_FIXTURE_TARGET');
      const actions=await deps.privacy.reportPersonalData(rows);
      // Only the documented closed fixture may request erasure in this run.
      // A changed test contract is a hold, not a false PASS.
      if(!Array.isArray(actions)||actions.length!==1||actions[0]?.accountId!==CLOSED||actions[0]?.status!=='closed')throw Error('PRIVACY_FIXTURE_RESPONSE');
      return {kind:'success',actions,cycleMs:null};
    },
    remediate:createFixtureRemediator(deps)
  });
}
