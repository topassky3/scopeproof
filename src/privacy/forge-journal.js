import { randomUUID } from 'node:crypto';
import { sameRecordValue } from '../shared/record-equality.js';
export const JOB_ENTITY='scopeproof-privacy-job';
export const FIXTURE_JOB_KEY='privacy-fixture:v2:journal';
// Key is fixed and never taken from a request. Forge storage is installation
// scoped. The new entity is separate from actual review storage.
export function createFixtureJournal({kvs,Filter,FilterConditions}) {
  const eq=FilterConditions.equalTo??FilterConditions.equalsTo;
  if(typeof eq!=='function')throw Error('PRIVACY_CAS_UNAVAILABLE');
  const entity=()=>kvs.entity(JOB_ENTITY);
  const read=async()=>{
    const r=await entity().get(FIXTURE_JOB_KEY);
    if(r==null)return null;
    if(!/^(0|[1-9][0-9]*)$/.test(r.revision)||!Number.isSafeInteger(Number(r.revision))||
      typeof r.token!=='string'||!r.token||!r.payload)throw Error('PRIVACY_JOURNAL_WRAPPER');
    return r;
  };
  async function receipt(value){
    try{return sameRecordValue(await read(),value);}catch{return false;}
  }
  return {
    read,
    async create(payload){
      const value={revision:'0',token:randomUUID(),payload};
      try{await entity().set(FIXTURE_JOB_KEY,value,{keyPolicy:'FAIL_IF_EXISTS'});return true;}
      catch{return receipt(value);}
    },
    async compareAndSet(old,payload){
      if(Number(old.revision)===Number.MAX_SAFE_INTEGER)throw Error('PRIVACY_JOURNAL_CAPACITY');
      const value={revision:String(Number(old.revision)+1),token:randomUUID(),payload};
      const conditions=new Filter().and('revision',eq.call(FilterConditions,old.revision)).and('token',eq.call(FilterConditions,old.token));
      try{await kvs.transact().set(FIXTURE_JOB_KEY,value,{entityName:JOB_ENTITY,conditions}).execute();return true;}
      catch{return receipt(value);}
    }
  };
}
