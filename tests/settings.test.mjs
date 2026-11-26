import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankReview, applyCommand, summarize } from '../src/domain.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/features/settings/SettingsPage.tsx');
const resolver = read('../src/index.js');
const manifest = read('../manifest.yml');
const app = read('../src/app/App.tsx');
const blank = () => blankReview({id:'1',key:'ACD-1',summary:'Test review',projectId:'1',projectKey:'ACD'});
const cmd = (r, type, fields = {}) => applyCommand(r, {type,expectedRevision:r.revision,...fields}, 'test-user');

test('Settings approval policy matches explicit mandatory approval and rejection rules', () => {
  assert.match(page, /Mandatory evidence coverage.*100%/);
  assert.match(page, /Minimum mandatory requirements for approval.*'1'/);
  assert.match(page, /Explicit approval.*Required/);
  let r = blank();
  assert.throws(() => cmd(r, 'approve'), /APPROVAL_BLOCKED/);
  r = cmd(r, 'addRequirement', {title:'Optional test', mandatory:false});
  assert.throws(() => cmd(r, 'approve'), /APPROVAL_BLOCKED/);
  r = cmd(r, 'addRequirement', {title:'Required test'});
  assert.throws(() => cmd(r, 'approve'), /APPROVAL_BLOCKED/);
  r = cmd(r, 'addEvidence', {requirementId:'RQ-02',title:'Passing test',result:'passed'});
  assert.equal(summarize(r).status, 'ready');
  assert.equal(summarize(cmd(r, 'approve')).status, 'approved');
  assert.match(page, /Rejection reason.*At least 5 characters/);
  assert.throws(() => cmd(r, 'reject', {note:'no'}), /rejection reason/i);
});

test('Settings evidence policy reflects version-specific latest evidence and optional HTTPS URL', () => {
  assert.match(page, /Evidence scope.*Current requirement version/);
  assert.match(page, /Coverage source.*Latest evidence for that version/);
  assert.match(page, /Evidence URL.*Optional; HTTPS prefix if supplied/);
  let r = cmd(blank(), 'addRequirement', {title:'Required test'});
  const fields = {requirementId:'RQ-01',title:'Test result',result:'passed'};
  assert.throws(() => cmd(r,'addEvidence',{...fields,url:'http://example.com'}), /HTTPS/);
  r = cmd(r,'addEvidence',fields);
  assert.equal(summarize(r).covered,1);
  r = cmd(r,'addEvidence',{...fields,result:'failed',url:'https://example.com'});
  assert.equal(summarize(r).rows[0].state,'failed');
  assert.equal(r.evidence.length,2);
  r = cmd(r,'publishVersion',{requirementId:'RQ-01',title:'Updated requirement'});
  assert.equal(summarize(r).rows[0].state,'stale');
  assert.equal(r.evidence.length,2);
});

test('Settings revalidation and concurrency wording matches current behavior without promising atomic writes', () => {
  assert.match(page, /Approval snapshot validation.*Active/);
  assert.match(page, /Fresh explicit decision required/);
  assert.match(page, /Atomic concurrent updates are not guaranteed in local preview/);
  assert.match(page, /Forge review writes use conditional storage operations/);
  assert.match(page, /deployment validation is pending/);
  let r = cmd(blank(),'addRequirement',{title:'Required test'});
  const fields = {requirementId:'RQ-01',title:'Passing test',result:'passed'};
  r = cmd(r,'addEvidence',fields);
  r = cmd(r,'approve');
  r = cmd(r,'publishVersion',{requirementId:'RQ-01',title:'Updated requirement'});
  assert.equal(summarize(r).status,'revalidation');
  r = cmd(r,'addEvidence',fields);
  assert.equal(summarize(r).covered,1);
  assert.equal(summarize(r).status,'revalidation');
  assert.throws(()=>applyCommand(r,{type:'approve',expectedRevision:r.revision-1}), /CONFLICT/);
  assert.equal(summarize(cmd(r,'approve')).status,'approved');
});

test('Settings documents manifest scopes and acting-user edit checks without claiming separate roles', () => {
  const block = manifest.split(/\r?\n/).filter(line=>/^\s+- (?:read:|storage:)/.test(line)).map(line=>line.trim().slice(2)).sort();
  const declared = [...page.matchAll(/<code>([^<]+)<\/code>/g)].map(m=>m[1]).sort();
  assert.deepEqual(declared, block);
  assert.deepEqual(block,['read:jira-user','read:jira-work','storage:app']);
  assert.match(resolver,/api\.asUser\(\)\.requestJira/);
  assert.match(resolver,/permissions=EDIT_ISSUES/);
  assert.match(resolver,/EDIT_ISSUES\?\.havePermission/);
  assert.match(page,/EDIT_ISSUES permission required/);
  assert.match(page,/no separate approver role/);
  assert.match(page,/not a live check of your personal permissions/);
});

test('Settings stays read-only, distinguishes preview from Forge and describes both export formats', () => {
  assert.match(app,/active === 'Settings' && <SettingsPage preview=\{preview\}/);
  assert.match(page,/preview \? 'Local preview' : 'Forge CES \+ legacy KVS \+ Jira'/);
  assert.match(page,/preview \? 'Browser local storage' : 'Forge CES \(legacy KVS read-only\)'/);
  assert.match(page,/Jira permission checks are not active in this preview/);
  assert.match(page,/Read-only/);
  assert.doesNotMatch(page,/<(?:button|input|select|textarea|form)\b|\bonClick\s*=|\b(?:localStorage|sessionStorage)\./);
  assert.match(page,/JSON \/ PDF/);
  assert.match(page,/free text may contain sensitive information/);
  assert.match(page,/Separate role management and notifications are not implemented/);
});
