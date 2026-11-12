import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, exampleReview, summarize } from '../src/domain.js';
import { evidenceOverview, findRequirements, requirementMetrics } from '../src/features/requirements/requirements-view.mjs';

function command(review, type, props = {}) {
  return applyCommand(review, { type, expectedRevision: review.revision, ...props }, 'preview-tester');
}

test('Requirements shows current, outdated and missing evidence correctly', () => {
  let review = exampleReview();
  let summary = summarize(review);
  const outdated = evidenceOverview(summary.rows[0], review.evidence);
  assert.equal(outdated.label, 'Outdated');
  assert.equal(outdated.current, null);
  assert.equal(outdated.previousCount, 1);
  assert.equal(evidenceOverview(summary.rows[1], review.evidence).label, 'Current');
  assert.equal(requirementMetrics(summary).attention, 1);
  review = command(review, 'addRequirement', {title:'Device trust must be verified', mandatory:false});
  summary = summarize(review);
  assert.equal(evidenceOverview(summary.rows.at(-1), review.evidence).label, 'Missing');
  assert.equal(requirementMetrics(summary).optional, 1);
  assert.equal(requirementMetrics(summary).mandatory, 3);
});

test('Requirements search and attention filters use supplied review rows', () => {
  const rows = summarize(exampleReview()).rows;
  assert.deepEqual(findRequirements(rows, 'rq-01').map(r => r.id), ['RQ-01']);
  assert.deepEqual(findRequirements(rows, 'sessions').map(r => r.id), ['RQ-02']);
  assert.deepEqual(findRequirements(rows, '', 'attention').map(r => r.id), ['RQ-01']);
  assert.deepEqual(findRequirements(rows, '', 'satisfied').map(r => r.id), ['RQ-02', 'RQ-03']);
  assert.equal(findRequirements(rows, 'not found').length, 0);
});

test('New version invalidates old evidence without deleting history or approval', () => {
  let review = exampleReview();
  review = command(review, 'addEvidence', {requirementId:'RQ-01', title:'New MFA test', result:'passed'});
  review = command(review, 'approve', {note:'Reapproved with MFA'});
  assert.equal(summarize(review).status, 'approved');
  const historySize = review.events.length;
  review = command(review, 'publishVersion', {
    requirementId:'RQ-02', title:'Sessions expire after 15 minutes',
  });
  const summary = summarize(review);
  assert.equal(summary.status, 'revalidation');
  assert.equal(summary.covered, 2);
  assert.equal(evidenceOverview(summary.rows[1], review.evidence).label, 'Outdated');
  assert.equal(review.approvals.length, 2);
  assert.ok(review.events.length > historySize);
});

test('Failed latest evidence appears as failed and still blocks approval', () => {
  let review = exampleReview();
  review = command(review, 'addEvidence', {requirementId:'RQ-01', title:'MFA regression', result:'failed'});
  const summary = summarize(review);
  assert.equal(evidenceOverview(summary.rows[0], review.evidence).label, 'Failed');
  assert.equal(summary.blockers.length, 1);
  assert.throws(() => command(review, 'approve'), /APPROVAL_BLOCKED/);
});

test('Creating an optional requirement does not change mandatory coverage', () => {
  let review = exampleReview();
  review = command(review, 'addRequirement', {title:'Support optional passkeys', mandatory:false});
  const summary = summarize(review);
  assert.equal(requirementMetrics(summary).total, 4);
  assert.equal(summary.mandatory, 3);
  assert.equal(summary.covered, 2);
  assert.equal(summary.blockers.length, 1);
});
