import { privacy } from '@forge/api';
import { kvs, WhereConditions } from '@forge/kvs';
import { createPrivacyInventoryAdapter } from './forge-storage.js';
import { inventoryStorage, reportInventory } from './cycle.js';

// Explicit non-production acceptance only. No real account reporting or
// destructive operations are reachable from this scheduled function.
export async function handler() {
  const mode=process.env.SCOPEPROOF_PRIVACY_MODE;
  if (mode!=='inventory' && mode!=='fixture-report') return {statusCode:204};
  try {
    if (mode==='inventory') {
      const result=await inventoryStorage(createPrivacyInventoryAdapter({kvs,WhereConditions}));
      console.info('PRIVACY_INVENTORY_COUNTS', {accounts:result.accounts.length, records:result.records.length});
    } else {
      // Official Atlassian test accounts only, not the contents of storage.
      const age='2020-01-01T00:00:00.000Z';
      const actions=await reportInventory([
        {accountId:'5be24ad8b1653240376955d2',updatedAt:age},
        {accountId:'5be24ba3f91c106033269289',updatedAt:age}
      ], rows=>privacy.reportPersonalData(rows));
      console.info('PRIVACY_FIXTURE_COUNTS', {closed:actions.filter(x=>x.status==='closed').length,updated:actions.filter(x=>x.status==='updated').length});
    }
    return {statusCode:204};
  } catch {
    // Never log response bodies, account identifiers, keys or review payloads.
    console.error('PRIVACY_AUDIT_FAILED');
    return {statusCode:500};
  }
}
