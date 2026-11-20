import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actorLabel, collectActorIds, extractUserNames, userBulkPath } from '../src/shared/actors/actor-names.mjs';

const A = '712020:a4fbbee9-97fc-41b6-b802-ab8d64bf4f83';
const B = '712020:abcd1234-97fc-41b6-b802-ab8d64bf1111';

test('Collects only unique real Jira actors, across audit and evidence', () => {
  const ids = collectActorIds({ events:[{actor:A},{actor:A},{actor:'demo'}],
    evidence:[{actor:B}], approvals:[{actor:A}],
    requirements:[{versions:[{actor:B}]}] });
  assert.deepEqual(ids, [A, B]);
});

test('Builds bounded and URL-encoded Jira user bulk lookups', () => {
  const url = userBulkPath([A,B,A]);
  assert.ok(url.startsWith('/rest/api/3/user/bulk?maxResults=25&'));
  assert.match(url, /accountId=712020%3Aa4fbbee9/);
  assert.equal((url.match(/accountId=/g) ?? []).length, 2);
  assert.equal(userBulkPath(['demo']), null);
});

test('Only displays explicitly returned allowed profile names', () => {
  const actual = extractUserNames({values:[
    {accountId:A,displayName:'  Jane QA  ',emailAddress:'hidden@example.com'},
    {accountId:B,displayName:'Other person'},
    {accountId:'unknown-id',displayName:'Impostor'},
  ]},[A]);
  assert.deepEqual(actual,{[A]:'Jane QA'});
  assert.equal(actorLabel(A,actual),'Jane QA');
});

test('Missing profile falls back to stable pseudonymous label, not full account id', () => {
  const label=actorLabel(A,{});
  assert.equal(label,'Jira user · bf4f83');
  assert.ok(!label.includes(A));
  assert.equal(actorLabel('demo',{}),'Demo user');
  assert.equal(actorLabel(null,{}),'Not recorded');
});

test('Display labels are shared between History and Evidence; original audit ids stay stored', () => {
  const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url),'utf8');
  const history = readFileSync(new URL('../src/features/history/HistoryPage.tsx', import.meta.url),'utf8');
  const evidence = readFileSync(new URL('../src/features/evidence/EvidencePage.tsx', import.meta.url),'utf8');
  const manifest = readFileSync(new URL('../manifest.yml', import.meta.url),'utf8');
  assert.match(app,/useActorNames\(review, !preview\)/);
  assert.match(app,/HistoryPage review=\{review\} actorNames=\{actorNames\}/);
  assert.match(evidence,/actorLabel\(selected\.actor, actorNames\)/);
  assert.match(history,/actorLabel\(event\.actor, actorNames\)/);
  assert.match(manifest,/read:jira-user/);
});
