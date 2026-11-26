import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, exampleReview, applyCommand, summarize } from '../src/domain.js';
import { readReviewForUse, requireReviewForUse, storedReviewRow } from '../src/review-read.js';
const issue = { id:'142', key:'ACO-142', projectId:'1', projectKey:'ACO', summary:'Authorized Jira summary' };
const cmd = (r,type,props={}) => applyCommand(r,{type,expectedRevision:r.revision,...props},'QA');
const approved = () => cmd(cmd(exampleReview(),'addEvidence',{requirementId:'RQ-01',result:'passed',title:'MFA test'}),'approve');
function unavailable(r, expected) {
  const before = structuredClone(r);
  const result = readReviewForUse(r, issue);
  assert.equal(result.ok,false); assert.equal(result.summary,null);
  assert.ok(result.issues.includes(expected));
  assert.throws(()=>requireReviewForUse(r,issue),/^Error: REVIEW_INSPECTION_REQUIRED$/);
  assert.deepEqual(storedReviewRow(r,issue),{issueKey:issue.key,summary:issue.summary,status:'inspection-required',covered:0,mandatory:0});
  assert.deepEqual(r,before);
}
test('Boundary: valid review preserves exact summary and project row',()=>{
  const r=approved(), before=structuredClone(r), s=summarize(r);
  assert.deepEqual(readReviewForUse(r,issue),{ok:true,issues:[],summary:s});
  assert.deepEqual(requireReviewForUse(r,issue),s);
  assert.deepEqual(storedReviewRow(r,issue),{issueKey:r.issueKey,summary:r.summary,status:'approved',covered:3,mandatory:3});
  assert.deepEqual(r,before);
});
test('Boundary: A07 null requirement cannot reach consumers',()=>{
  const r=exampleReview();r.requirements.push(null);unavailable(r,'INVALID_REQUIREMENT');
});
test('Boundary: sparse requirements and non-array structures are unavailable',()=>{
  const r=exampleReview();r.requirements.length++;unavailable(r,'INVALID_REQUIREMENT');
  unavailable({...exampleReview(),events:null},'INVALID_REVIEW_STRUCTURE');
  unavailable(null,'INVALID_REVIEW_STRUCTURE');
});
test('Boundary: historical corruption does not yield trusted counts or payload',()=>{
  for(const [corrupt,code] of [
    [r=>r.requirements[0].versions.push(null),'INVALID_REQUIREMENT_VERSION'],
    [r=>r.events.push(null),'INVALID_AUDIT_EVENT'],
    [r=>r.approvals.unshift(null),'INVALID_HISTORICAL_DECISION']]) {
    const r=approved();corrupt(r);unavailable(r,code);
  }
});
test('Boundary: approved aggregate with duplicate evidence is masked',()=>{
  const r=approved();r.evidence.push(structuredClone(r.evidence[0]));assert.equal(summarize(r).status,'approved');
  unavailable(r,'AMBIGUOUS_EVIDENCE_ID');
});
test('Boundary: mismatched stored identity does not leak foreign metadata',()=>{
  for(const [key,value] of [['issueId','wrong'],['issueKey','OTHER-2'],['projectId','wrong'],['projectKey','OTHER']]) {
    const r=approved();r[key]=value;r.summary='Foreign private text';unavailable(r,'REVIEW_IDENTITY_MISMATCH');
  }
});
test('Boundary: malformed display fields are not handed to React or PDF consumers',()=>{
  for(const corrupt of [r=>{r.requirements[0].title={x:1};},r=>{r.evidence[0].actor={x:1};},r=>{r.events[0].createdAt={x:1};},r=>{r.approvals[0].note={x:1};}]) {
    const r=approved();corrupt(r);const result=readReviewForUse(r,issue);
    assert.equal(result.ok,false);assert.equal(result.summary,null);
    assert.throws(()=>requireReviewForUse(r,issue),/REVIEW_INSPECTION_REQUIRED/);
  }
  unavailable({...approved(),summary:{}},'INVALID_REVIEW_IDENTITY');
});
test('Boundary: empty scope, valid rejection and legacy optional metadata remain usable',()=>{
  const r=approved();delete r.events[0].type;delete r.events[0].actor;delete r.events[0].createdAt;
  assert.equal(readReviewForUse(r,issue).ok,true);
  assert.equal(readReviewForUse(blankReview(issue),issue).summary.status,'pending');
  const rejected=cmd(r,'reject',{note:'Human decision'});
  assert.equal(readReviewForUse(rejected,issue).summary.status,'rejected');
});

test('Boundary wiring: App gates raw review before render helpers and keeps Django route separate', async()=>{
  const {readFileSync}=await import('node:fs');
  const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
  assert.match(app,/const review = read\?\.ok \? rawReview : null/);
  assert.match(app,/readReviewForUse\(rawReview\)/);
  assert.doesNotMatch(app,/\bsummarize\(/);
  assert.match(app,/useActorNames\(review, !preview\)/);
  assert.match(app,/sessionReviews \? <LocalReviewsPage csrfToken=\{csrfToken!\}\/> : read && !read.ok/);
  assert.match(app,/modal&&review&&<div/);
  assert.match(app,/readReviewForUse\(stored\).ok/);
});
test('Boundary wiring: resolver authorizes before storage and validates before conditional writes', async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  const store=readFileSync(new URL('../src/review-store.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bsummarize\(/);
  assert.match(source,/const issue = await jiraIssue\(payload.issueKey\);\s*return store.getReview\(issue\)/);
  const command=source.slice(source.indexOf("resolver.define('command'"),source.indexOf("resolver.define('listReviews'"));
  assert.ok(command.indexOf('EDIT_PERMISSION_REQUIRED') < command.indexOf('return store.command'));
  assert.match(store,/requireReviewForUse\(review, issue\)/);
  assert.match(store,/requireReviewForUse\(record.review, issue\)/);
  const order=['const old = await load(issue)','applyCommand(old.review','requireReviewForUse(value.review, issue)','await io.replaceIfRevision'];
  let prior=-1;
  for(const needle of order){const position=store.indexOf(needle);assert.ok(position>prior,needle);prior=position;}
  assert.match(store,/storedReviewRow\(loaded.review, issue\)/);
  assert.match(source,/const row = await store.row\(issue\)/);
  assert.doesNotMatch(source,/kvs.set\(/);
});
