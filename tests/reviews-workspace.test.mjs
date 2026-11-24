import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, exampleReview, summarize } from '../src/domain.js';
import { buildReviewRows, filterReviewRows, reviewImpact } from '../src/features/overview/overview-model.js';
import { latestReviewDecision, reviewActionMessage } from '../src/features/reviews/reviews-model.mjs';

test('Reviews never invent additional Jira issues when the index is empty', () => {
  const review = exampleReview();
  const rows = buildReviewRows(review,summarize(review),[]);
  assert.deepEqual(rows.map(row=>row.issueKey),['ACO-142']);
});

test('Reviews search and filtering depend only on saved project rows', () => {
  const review = exampleReview();
  const rows = buildReviewRows(review,summarize(review),[
    {issueKey:'ACO-168',summary:'Mobile tests',status:'approved',covered:2,mandatory:2},
    {issueKey:'ACO-169',summary:'Session issue',status:'rejected',covered:0,mandatory:1},
  ]);
  assert.deepEqual(filterReviewRows(rows,'mobile','approved').map(row=>row.issueKey),['ACO-168']);
  assert.deepEqual(filterReviewRows(rows,'','rejected').map(row=>row.issueKey),['ACO-169']);
  assert.equal(filterReviewRows(rows,'invented').length,0);
});

test('Latest review decision is derived from actual approvals, including rejection note', () => {
  let review = exampleReview();
  let latest = latestReviewDecision(review);
  assert.equal(latest.type,'approved');
  assert.equal(latest.snapshotCount,3);
  review = applyCommand(review,{type:'reject',expectedRevision:review.revision,note:'Missing signed security report'},'QA');
  latest = latestReviewDecision(review);
  assert.equal(latest.type,'rejected');
  assert.equal(latest.note,'Missing signed security report');
});

test('Absent decisions do not generate fake actors, dates or approvals', () => {
  assert.equal(latestReviewDecision({approvals:[]}),null);
  assert.equal(latestReviewDecision({approvals:[{}]}),null);
  const message = reviewActionMessage({mandatory:0,blockers:[],status:'pending'});
  assert.match(message,/at least one mandatory requirement/i);
});

test('Revalidation messaging is accurate when all evidence is current but a fresh decision is missing', () => {
  const review = exampleReview();
  const next = applyCommand(review,{type:'addEvidence',expectedRevision:review.revision,
    requirementId:'RQ-01',title:'Fresh evidence',result:'passed'},'QA');
  const summary=summarize(next);
  assert.equal(summary.blockers.length,0);
  assert.equal(summary.status,'revalidation');
  assert.match(reviewActionMessage(summary),/explicit/i);
  const impact=reviewImpact(next,summary);
  assert.equal(impact.outdatedEvidence,1);
  assert.equal(impact.approvalsToRevalidate,1);
});

test('Reviews and Overview use the same Forge-selected review and display-name projection', () => {
  const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
  const reviews=readFileSync(new URL('../src/features/reviews/ReviewWorkspace.tsx',import.meta.url),'utf8');
  const overview=readFileSync(new URL('../src/features/overview/OverviewPage.tsx',import.meta.url),'utf8');
  assert.match(app,/ReviewsPage review=\{review\} summary=\{summary\} list=\{list\}/);
  assert.match(reviews,/buildReviewRows\(review, summary, list\)/);
  assert.match(reviews,/actorLabel\(decision\.actor,actorNames\)/);
  assert.match(overview,/actorLabel\(event\.actor, actorNames\)/);
});

test('Reviews and Overview have mobile record labels and all state filters', () => {
  const reviews=readFileSync(new URL('../src/features/reviews/ReviewWorkspace.tsx',import.meta.url),'utf8');
  const overview=readFileSync(new URL('../src/features/overview/OverviewPage.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/features/reviews/reviews.css',import.meta.url),'utf8');
  assert.match(reviews,/data-label="Coverage"/);
  assert.match(overview,/data-label="Coverage"/);
  assert.match(overview,/id: 'rejected'/);
  assert.match(css,/@media\(max-width:760px\)/);
});
