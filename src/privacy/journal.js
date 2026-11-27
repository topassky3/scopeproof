import { isAccountId } from './review-data.js';
import { reportInventory } from './cycle.js';

const phases=new Set(['ready','sending','pending','remediating','complete']);
const statuses=new Set(['closed','updated']);
const finite=n=>Number.isSafeInteger(n)&&n>=0;
function validAccounts(accounts) {
  return Array.isArray(accounts)&&accounts.length>0&&accounts.length<=90&&
    new Set(accounts.map(x=>x?.accountId)).size===accounts.length&&
    accounts.every(x=>isAccountId(x?.accountId)&&typeof x.updatedAt==='string'&&Number.isFinite(Date.parse(x.updatedAt)));
}
function validate(s) {
  if (!s||s.schema!==1||!phases.has(s.phase)||!finite(s.notBefore)||!finite(s.attempts)||
      !finite(s.closed)||!finite(s.updated)||!finite(s.remediated)||
      !(s.nextEligibleAt===null||finite(s.nextEligibleAt))) throw Error('PRIVACY_JOURNAL_INVALID');
  if (s.phase==='complete') {
    if (s.accounts.length!==0||s.actions.length!==0||s.remediated!==s.closed+s.updated) throw Error('PRIVACY_JOURNAL_INVALID');
    return s;
  }
  if (!validAccounts(s.accounts)||!Array.isArray(s.actions)||
      s.actions.some(x=>!statuses.has(x?.status)||!s.accounts.some(a=>a.accountId===x.accountId))||
      new Set(s.actions.map(x=>x.accountId)).size!==s.actions.length) throw Error('PRIVACY_JOURNAL_INVALID');
  if (['ready','sending'].includes(s.phase)&&(s.actions.length||s.closed||s.updated||s.remediated)) throw Error('PRIVACY_JOURNAL_INVALID');
  if (['pending','remediating'].includes(s.phase)&&(!s.actions.length||s.actions.length+s.remediated!==s.closed+s.updated)) throw Error('PRIVACY_JOURNAL_INVALID');
  return s;
}
export function newBatch(accounts, now=Date.now()) {
  if(!validAccounts(accounts)||!finite(now))throw Error('PRIVACY_BATCH_INVALID');
  return validate({schema:1,phase:'ready',accounts:structuredClone(accounts),actions:[],notBefore:now,
    attempts:0,closed:0,updated:0,remediated:0,nextEligibleAt:null});
}
function complete(s) {
  return validate({...s,phase:'complete',accounts:[],actions:[]});
}
async function save(io,old,payload) {
  validate(payload);
  return await io.compareAndSet(old,payload)===true;
}
// Journal phases are durable, not process-local. At an ambiguous network or
// maintenance outcome we HOLD the claim rather than send twice or overwrite.
// A verified reconciliation procedure is still required before real use.
export async function advanceBatch(io,{report,remediate,now=Date.now(),fixture=false}) {
  if(!finite(now))throw Error('PRIVACY_CLOCK_INVALID');
  const old=await io.read();
  if(!old)throw Error('PRIVACY_JOURNAL_MISSING');
  const s=validate(old.payload);
  if(s.phase==='complete')return {status:'complete',closed:s.closed,updated:s.updated,remediated:s.remediated};
  if(s.phase==='sending'||s.phase==='remediating')return {status:'held'};
  if(s.notBefore>now)return {status:'waiting'};
  if(s.phase==='ready'){
    const claim={...s,phase:'sending',attempts:s.attempts+1};
    if(!await save(io,old,claim))return {status:'conflict'};
    const claimed=await io.read();
    // The only legal successor of this claim is its owner. Validate exact
    // state before the external call; adapter CAS verifies exact token.
    if(!claimed||claimed.payload.phase!=='sending'||claimed.payload.attempts!==claim.attempts)throw Error('PRIVACY_CLAIM_LOST');
    let response;
    try{response=await report(structuredClone(s.accounts));}catch{ return {status:'held'}; }
    // Explicit known rejection is the only automatic retry path. The Forge
    // helper throws without a documented header interface, so it never
    // supplies this classification; generic transport adapters may do so.
    if(response?.kind==='retry'){
      const delay=response.retryAfterMs;
      if(!Number.isSafeInteger(delay)||delay<1000||delay>30*86400000||!finite(now+delay))return {status:'held'};
      if(!await save(io,claimed,{...claim,phase:'ready',notBefore:now+delay}))return {status:'held'};
      return {status:'waiting'};
    }
    if(response?.kind!=='success')return {status:'held'};
    const cycle=response.cycleMs;
    if(!(fixture&&cycle===null)&&(!Number.isSafeInteger(cycle)||cycle<=0||!finite(now+cycle)))return {status:'held'};
    let actions;
    try{actions=await reportInventory(s.accounts,async()=>response.actions);}catch{return {status:'held'};}
    const next={...claim,phase:'pending',actions,closed:actions.filter(a=>a.status==='closed').length,
      updated:actions.filter(a=>a.status==='updated').length,nextEligibleAt:cycle===null?null:now+cycle};
    if(!await save(io,claimed,actions.length?next:complete(next)))return {status:'held'};
    return {status:actions.length?'pending':'complete'};
  }
  // Exactly one action per durable claim. The callback must independently
  // verify remediation. False/throw leaves a visible, non-retryable hold.
  const claim={...s,phase:'remediating'};
  if(!await save(io,old,claim))return {status:'conflict'};
  const claimed=await io.read();
  if(!claimed||claimed.payload.phase!=='remediating')throw Error('PRIVACY_CLAIM_LOST');
  let ok;
  try{ok=await remediate(structuredClone(s.actions[0]));}catch{return {status:'held'};}
  if(ok!==true)return {status:'held'};
  const next={...claim,phase:'pending',actions:s.actions.slice(1),remediated:s.remediated+1};
  if(!await save(io,claimed,next.actions.length?next:complete(next)))return {status:'held'};
  return {status:next.actions.length?'pending':'complete'};
}
