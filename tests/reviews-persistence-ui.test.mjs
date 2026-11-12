import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewRows, filterReviewRows, reviewMetrics } from '../src/features/reviews/review-list-model.mjs';
import { buildHistoryEntries } from '../src/features/history/history-model.mjs';

const rows = [
  { issueKey: 'ACO-142', summary: 'Implement SSO authentication', status: 'revalidation', covered: 2, mandatory: 3 },
  { issueKey: 'ACO-143', summary: 'Improve logs', status: 'approved', covered: 1, mandatory: 1 },
];

test('Reviews filters imported from Lopera: search and status', () => {
  assert.deepEqual(filterReviewRows(rows, 'sso', 'revalidation').map(r => r.issueKey), ['ACO-142']);
  assert.deepEqual(filterReviewRows(rows, 'aco-143').map(r => r.issueKey), ['ACO-143']);
  assert.equal(filterReviewRows(rows, 'sso', 'approved').length, 0);
  assert.equal(filterReviewRows(rows, '', 'all').length, 2);
});

test('Selected Django review overrides stale list projection', () => {
  const selected = { issueKey: 'ACO-142', summary: 'Updated SSO', revision: 9 };
  const summary = { status: 'approved', covered: 3, mandatory: 3 };
  const merged = buildReviewRows(selected, summary, rows);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].status, 'approved');
  assert.equal(merged[0].summary, 'Updated SSO');
});

test('Review metrics are derived from persisted rows, not sample records', () => {
  const m = reviewMetrics(rows);
  assert.deepEqual(m, { reviews: 2, approved: 1, revalidation: 1, notFinalized: 0 });
});

test('Rejection reason belongs to matching event only', () => {
  const review = {
    approvals: [
      { type: 'rejected', actor: 'u1', createdAt: '2026-11-12T11:00:00Z', note: 'Missing evidence' },
      { type: 'rejected', actor: 'u2', createdAt: '2026-11-12T12:00:00Z', note: 'Wrong test result' },
    ],
    events: [
      { id: 'e1', type: 'review-rejected', description: 'Review rejected', actor: 'u1', createdAt: '2026-11-12T11:00:00Z' },
      { id: 'e2', type: 'review-rejected', description: 'Review rejected', actor: 'u2', createdAt: '2026-11-12T12:00:00Z' },
      { id: 'e3', type: 'requirement-updated', description: 'Changed requirement', actor: 'u1', createdAt: '2026-11-12T13:00:00Z' },
    ],
  };
  const history = buildHistoryEntries(review);
  assert.equal(history[0].rejectionReason, null);
  assert.equal(history[1].rejectionReason, 'Wrong test result');
  assert.equal(history[2].rejectionReason, 'Missing evidence');
});

test('No rejection reason is invented if decision does not match actor or timestamp', () => {
  const history = buildHistoryEntries({
    approvals: [{ type: 'rejected', actor: 'u1', createdAt: '2026-11-12T10:00:00Z', note: 'Private note' }],
    events: [{ id: 'e1', type: 'review-rejected', actor: 'u2', createdAt: '2026-11-12T10:00:00Z', description: 'Review rejected' }],
  });
  assert.equal(history[0].rejectionReason, null);
});
