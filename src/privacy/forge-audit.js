import { privacy,getAppContext } from '@forge/api';
import { kvs,WhereConditions,Filter,FilterConditions } from '@forge/kvs';
import { createPrivacyInventoryAdapter } from './forge-storage.js';
import { inventoryStorage } from './cycle.js';
import { fixtureAllowed,runFixture } from './fixture.js';

// No real report or erasure path. Require platform development context and
// exact installation opt-in for both modes, not merely an environment flag.
export async function handler() {
  const mode=process.env.SCOPEPROOF_PRIVACY_MODE;
  if(mode!=='inventory'&&mode!=='fixture-report')return {statusCode:204};
  try {
    const context=getAppContext();
    if(!fixtureAllowed(context,process.env))return {statusCode:204};
    if(mode==='inventory'){
      const result=await inventoryStorage(createPrivacyInventoryAdapter({kvs,WhereConditions}));
      console.info('PRIVACY_INVENTORY_COUNTS',{accounts:result.accounts.length,records:result.records.length});
    }else{
      const result=await runFixture({kvs,Filter,FilterConditions,privacy},context,process.env);
      if(result.status==='held'){console.error('PRIVACY_FIXTURE_HELD');return {statusCode:500};}
      console.info('PRIVACY_FIXTURE_STATE',result);
    }
    return {statusCode:204};
  }catch{
    console.error('PRIVACY_AUDIT_FAILED');
    return {statusCode:500};
  }
}
