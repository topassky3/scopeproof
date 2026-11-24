import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, blankReview, exampleReview, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { reviewDecisionPresentation } from '../src/features/reviews/reviews-intelligence.js';
import { projectOverviewRows } from '../src/features/overview/overview-intelligence.js';
const run = (r, command) => applyCommand(r, { ...command, expectedRevision: r.revision }, 'QA');
const pass = r => run(r, { type:'addEvidence', requirementId:'RQ-01', title:'Current test passes', result:'passed' });
const approve = r => run(r, { type:'approve' });
const present = r => reviewDecisionPresentation(buildReviewIntelligence(r));
const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Reviews uses the same minimal plan and explicit reapproval message as the shared engine', () => {
  const r = exampleReview(), before = structuredClone(r), intelligence = buildReviewIntelligence(r);
  assert.equal(intelligence.plan.minimumActions, 2);
  assert.equal(intelligence.plan.retainedEvidence.length, 2);
  assert.match(present(r).heading, /reapproval/i);
  assert.match(present(r).message, /blocked mandatory requirements/i);
  assert.deepEqual(r, before);
});
test('Reviews distinguishes 100% coverage requiring one decision from an approved review', () => {
  const r = pass(exampleReview()), i = buildReviewIntelligence(r);
  assert.equal(i.impact.coveragePercent, 100);
  assert.equal(i.plan.minimumActions, 1);
  assert.match(present(r).message, /fresh explicit approval/i);
  const next = approve(r);
  assert.equal(buildReviewIntelligence(next).plan.minimumActions, 0);
  assert.equal(present(next).heading, 'Current review approved');
});
test('Reviews rejection takes priority over both full and incomplete coverage', () => {
  for (const r of [exampleReview(), pass(exampleReview())]) {
    const next = run(r,{type:'reject',note:'Requires manual reconsideration'});
    assert.equal(present(next).heading,'Review rejected');
    assert.match(present(next).message,/human reconsideration/i);
    assert.equal(buildReviewIntelligence(next).plan.minimumActions,null);
  }
});
test('Reviews distinguishes scope definition and first explicit approval', () => {
  let r = blankReview({id:'1',key:'TEST-1',summary:'Review',projectId:'2',projectKey:'TEST'});
  assert.match(present(r).heading,/no mandatory/i);
  r = run(r,{type:'addRequirement',title:'Verify access',mandatory:true});
  assert.match(present(r).heading,/mandatory evidence required/i);
  r = pass(r);
  assert.match(present(r).message,/initial explicit approval/i);
});
test('Reviews suppresses decisions and selected approved counts when integrity fails', () => {
  const r = approve(pass(exampleReview()));
  r.evidence.push(structuredClone(r.evidence[0]));
  assert.equal(summarize(r).status,'approved');
  const i = buildReviewIntelligence(r);
  assert.equal(present(r).decisionBlocked,true);
  assert.equal(present(r).heading,'Inspection required');
  const rows = [{issueKey:r.issueKey,status:'approved'},{issueKey:'OTHER-1',status:'approved'}];
  assert.deepEqual(projectOverviewRows(rows,r.issueKey,i).map(row=>row.status),['inspection-required','approved']);
});
test('Reviews uses current revision after a command rather than an old recovery plan', () => {
  const first=exampleReview(), second=pass(first);
  assert.equal(buildReviewIntelligence(second).revision,first.revision+1);
  assert.notEqual(present(first).message,present(second).message);
});
test('Reviews wiring preserves optional Django behavior and gates unavailable advice', () => {
  const workspace=source('src/features/reviews/ReviewWorkspace.tsx');
  const wrapper=source('src/features/reviews/ReviewsPage.tsx');
  const panel=source('src/features/reviews/ReviewPlanPanel.tsx');
  assert.match(workspace,/intelligence\?: ReviewIntelligence/);
  assert.match(wrapper,/intelligence: ReviewIntelligence/);
  assert.match(workspace,/intelligence \? <ReviewPlanPanel/);
  assert.match(workspace,/: impact && <Panel title="Change impact"/);
  assert.match(workspace,/inspectionRequired \? <p role="alert">Coverage and recovery advice unavailable/);
  assert.match(panel,/intelligence.kind === 'unavailable'/);
  assert.match(panel,/plan.minimumActions !== null/);
  assert.doesNotMatch(panel,/applyCommand|invoke\(|onClick=/);
});
test('Forge decision UI and command entry block inspection cases without changing Django routing', () => {
  const app=source('src/app/App.tsx');
  assert.match(app,/review && !sessionReviews \? buildReviewIntelligence\(review\)/);
  assert.match(app,/sessionReviews \? <LocalReviewsPage csrfToken=\{csrfToken!\}/);
  assert.match(app,/intelligence=\{intelligence!\}/);
  assert.match(app,/disabled=\{busy \|\| decisionInspectionRequired\}/);
  assert.match(app,/summary.status === 'approved' \|\| decisionInspectionRequired/);
  assert.match(app,/\(type === 'approve' \|\| type === 'reject'\) && buildReviewIntelligence\(review\).kind === 'unavailable'/);
});
