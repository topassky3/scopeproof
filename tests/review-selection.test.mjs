import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectionScope,matchesProject,readSelection,rememberSelection,forgetSelection} from '../src/app/review-selection.mjs';
const context = {moduleKey:'scopeproof-project',cloudId:'site-a',accountId:'user-a',environmentId:'env-a',extension:{project:{id:'10001',key:'ACD'}}};
const review = {issueKey:'ACD-1',projectId:'10001',projectKey:'ACD',summary:'Never cached',events:[{description:'Never cached'}]};
function memory(){const map=new Map();return {map,provider:()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)})};}

test('Project page remembers only a confirmed issue key and restores it on reload',()=>{
 const {map,provider}=memory(),scope=selectionScope(context);
 assert.ok(scope);assert.equal(readSelection(scope,provider),null);
 assert.equal(rememberSelection(scope,review,provider),true);
 assert.deepEqual([...map.values()],['ACD-1']);
 assert.equal(readSelection(selectionScope(structuredClone(context)),provider),'ACD-1');
});
test('Different account, cloud, environment and project never share selection',()=>{
 const {provider}=memory(),scope=selectionScope(context);
 rememberSelection(scope,review,provider);
 for(const changed of [{...context,accountId:'user-b'},{...context,cloudId:'site-b'},{...context,environmentId:'env-b'},{...context,extension:{project:{id:'10002',key:'ACD'}}}]) {
   assert.equal(readSelection(selectionScope(changed),provider),null);
 }
});
test('Missing identity and explicit issue panel never restore project preference',()=>{
 assert.equal(selectionScope({...context,accountId:undefined}),null);
 assert.equal(selectionScope({...context,moduleKey:'scopeproof-issue'}),null);
 assert.equal(selectionScope({...context,extension:{...context.extension,issue:{key:'ACD-2'}}}),null);
});
test('Invalid keys and mismatched project response cannot be restored or remembered',()=>{
 const {map,provider}=memory(),scope=selectionScope(context);
 for(const key of ['OTHER-1','ACD-0','ACD-1/path','ACD-1-extra','ACD-01']){
   map.set(scope.key,key);assert.equal(readSelection(scope,provider),null);
   assert.equal(rememberSelection(scope,{...review,issueKey:key},provider),false);
 }
 assert.equal(matchesProject(scope,{...review,projectId:'999'}),false);
 assert.equal(rememberSelection(scope,{...review,projectKey:'OTHER'},provider),false);
 forgetSelection(scope,provider);assert.equal(readSelection(scope,provider),null);
});
test('Blocked browser storage does not prevent normal review access',()=>{
 const blocked=()=>{throw new Error('SecurityError')},scope=selectionScope(context);
 assert.equal(readSelection(scope,blocked),null);
 assert.equal(rememberSelection(scope,review,blocked),false);
 assert.doesNotThrow(()=>forgetSelection(scope,blocked));
});
test('Restoration is read-only and uses existing authorized resolver, not a cached review',()=>{
 const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
 assert.match(app,/if\(remembered\) await fetchReview\(remembered, true\)/);
 assert.match(app,/invoke\('getReview',\{issueKey:clean\}\)/);
 assert.match(app,/restoring && !matchesProject\(scope,loaded\)/);
 assert.match(app,/forgetSelection\(selectionRef.current/);
 assert.match(app,/disabled=\{busy \|\| initializing\}/);
});
