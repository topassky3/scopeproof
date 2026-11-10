import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeDemoReview, deriveReview, canApprove, buildReviewList,
  filterReviewList, reviewMetrics, applyPreviewCommand,
} from '../lib/review-model.mjs';

const demo = () => makeDemoReview();
const command = (review, type, data = {}) =>
  applyPreviewCommand(review, { type, expectedRevision: review.revision, ...data });

test('sample review is revalidation with coverage 2/3, not approved', () => {
  const s = deriveReview(demo());
  assert.equal(s.status, 'revalidation');
  assert.equal(s.mandatory, 3);
  assert.equal(s.covered, 2);
  assert.equal(s.blockers.length, 1);
  assert.equal(s.rows[0].state, 'stale');
  assert.equal(canApprove(s), false);
});

test('stale does not erase the passed result of historical evidence', () => {
  const r = demo();
  assert.equal(r.evidence[0].result, 'passed');
  assert.equal(deriveReview(r).rows[0].state, 'stale');
});

test('latest failed result blocks approval even after a passed result', () => {
  let r = command(demo(), 'addEvidence', {
    requirementId: 'RQ-01', title: 'MFA succeeds', result: 'passed',
  });
  r = command(r, 'addEvidence', {
    requirementId: 'RQ-01', title: 'MFA regression', result: 'failed',
  });
  const s = deriveReview(r);
  assert.equal(s.rows[0].state, 'failed');
  assert.equal(canApprove(s), false);
  assert.throws(() => command(r, 'approve'), /APPROVAL_BLOCKED/);
});

test('current passed evidence covers a requirement but does not automatically reapprove', () => {
  const r = command(demo(), 'addEvidence', {
    requirementId: 'RQ-01', title: 'MFA v2 passed', result: 'passed',
  });
  const s = deriveReview(r);
  assert.equal(s.covered, 3);
  assert.equal(s.status, 'revalidation');
  assert.equal(canApprove(s), true);
  assert.equal(r.approvals.length, 1);
});

test('explicit reapproval preserves history and records current snapshots', () => {
  let r = command(demo(), 'addEvidence', {
    requirementId: 'RQ-01', title: 'MFA v2 passed', result: 'passed',
  });
  r = command(r, 'approve');
  assert.equal(deriveReview(r).status, 'approved');
  assert.equal(r.approvals.length, 2);
  assert.equal(r.approvals[0].snapshot[0].version, 1);
  assert.equal(r.approvals[1].snapshot[0].version, 2);
  assert.equal(r.approvals[1].snapshot[0].evidenceId, 'EV-104');
});

test('cannot approve without mandatory requirements', () => {
  const r = { requirements: [], evidence: [], approvals: [] };
  assert.equal(canApprove(deriveReview(r)), false);
});

test('rejection requires meaningful reason and adds history', () => {
  assert.throws(() => command(demo(), 'reject', { note: 'no' }), /rejection reason/);
  const r = command(demo(), 'reject', { note: 'MFA remains unverified' });
  assert.equal(deriveReview(r).status, 'rejected');
  assert.equal(r.approvals.at(-1).note, 'MFA remains unverified');
  assert.equal(r.events.length, 3);
});

test('stale revision conflicts are rejected in preview', () => {
  assert.throws(() => applyPreviewCommand(demo(), {
    type: 'approve', expectedRevision: 0,
  }), /CONFLICT/);
});

test('a selected review replaces an old index row without inventing more records', () => {
  const r = demo();
  const rows = buildReviewList(r, deriveReview(r), [
    { issueKey: 'ACO-142', summary: 'Outdated', status: 'approved', covered: 3, mandatory: 3 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'revalidation');
});

test('search, status filters and totals derive from supplied rows', () => {
  const rows = buildReviewList(demo(), deriveReview(demo()), [
    { issueKey: 'ACO-150', summary: 'Session cleanup', status: 'approved', covered: 2, mandatory: 2 },
  ]);
  assert.equal(filterReviewList(rows, 'sso').length, 1);
  assert.equal(filterReviewList(rows, 'ACO-150', 'approved').length, 1);
  assert.equal(filterReviewList(rows, '', 'ready').length, 0);
  assert.deepEqual(reviewMetrics(rows), {
    reviews: 2, approved: 1, revalidation: 1, notFinalized: 0,
  });
});
