import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, exampleReview, summarize } from '../src/domain.js';
import { buildReviewRows, filterReviewRows, overviewMetrics, recentReviewActivity, reviewImpact } from '../src/features/overview/overview-model.js';

const review = exampleReview();
const summary = summarize(review);

test('overview shows actual selected review without invented issues', () => {
  const rows = buildReviewRows(review, summary, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].issueKey, 'ACO-142');
  assert.equal(rows[0].status, 'revalidation');
  assert.deepEqual(overviewMetrics(rows), { total:1, approved:0, revalidation:1, inReview:0, pending:0, rejected:0 });
});

test('overview selected review replaces a stale project index row', () => {
  const rows = buildReviewRows(review, summary, [
    { issueKey:'ACO-142', summary:'Old', status:'approved', covered:3, mandatory:3 },
    { issueKey:'ACO-143', summary:'Other issue', status:'pending', covered:0, mandatory:1 },
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows.find(x=>x.issueKey==='ACO-142').status,'revalidation');
});

test('overview search and status filters use real review rows', () => {
  const rows = buildReviewRows(review, summary, [
    {issueKey:'ACO-143',summary:'Session management',status:'ready',covered:3,mandatory:3},
  ]);
  assert.equal(filterReviewRows(rows,'SSO','all').length,1);
  assert.equal(filterReviewRows(rows,'','in-review')[0].issueKey,'ACO-143');
  assert.equal(filterReviewRows(rows,'','approved').length,0);
});

test('change impact identifies precisely the outdated evidence and historical approval', () => {
  const impact = reviewImpact(review,summary);
  assert.equal(impact.staleRequirements,1);
  assert.equal(impact.outdatedEvidence,1);
  assert.equal(impact.approvalsToRevalidate,1);
  assert.equal(impact.affected.id,'RQ-01');
});

test('new passing evidence removes stale requirement and revalidation on fresh approval', () => {
  let next = applyCommand(review, {type:'addEvidence',expectedRevision:review.revision,requirementId:'RQ-01',title:'MFA passes',result:'passed'}, 'QA');
  next = applyCommand(next,{type:'approve',expectedRevision:next.revision},'QA');
  const impact=reviewImpact(next,summarize(next));
  assert.equal(impact.staleRequirements,0);
  assert.equal(impact.approvalsToRevalidate,0);
});

test('activity keeps newest events at the top', () => {
  const data=recentReviewActivity(review,2);
  assert.equal(data.length,2);
  assert.match(data[0].description,/revalidation/i);
});
