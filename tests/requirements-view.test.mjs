import { readFileSync } from 'node:fs';
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

test('An empty review is not reported as having passed mandatory coverage', () => {
  const empty = { requirements: [], evidence: [], approvals: [], events: [], revision: 0 };
  const summary = summarize(empty);
  const metrics = requirementMetrics(summary);
  assert.equal(metrics.total, 0);
  assert.equal(metrics.mandatory, 0);
  assert.equal(metrics.covered, 0);
  assert.equal(metrics.attention, 0);
  assert.notEqual(summary.status, 'approved');
});

test('Requirements only shows sample-data disclaimer in development', () => {
  const source = readFileSync(new URL('../src/features/requirements/RequirementsPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /\{import\.meta\.env\.DEV && <div className="rq-preview-help">/);
  assert.match(source, /const needsReview = requiresAttention \|\| metrics\.mandatory === 0 \|\| summary\.status === 'revalidation' \|\| summary\.status === 'rejected'/);
  assert.match(source, /const presentation = reviewDecisionPresentation\(intelligence\)/);
  assert.match(source, /<strong>\{presentation.heading\}<\/strong>/);
  assert.match(source, /<p>\{presentation.message\}<\/p>/);
});

test('Requirements shared decision presentation preserves approval invariants', async () => {
  const { buildReviewIntelligence } =
    await import('../src/shared/review-intelligence.js');
  const { reviewDecisionPresentation } =
    await import('../src/features/reviews/reviews-intelligence.js');

  const present = review =>
    reviewDecisionPresentation(buildReviewIntelligence(review));

  const empty = {
    requirements: [], evidence: [],
    approvals: [], events: [], revision: 0
  };

  const optional = command(empty, 'addRequirement', {
    title: 'Optional requirement', mandatory: false
  });

  for (const review of [empty, optional]) {
    assert.equal(summarize(review).mandatory, 0);
    assert.match(present(review).heading, /no mandatory requirements/i);
    assert.match(present(review).message, /define mandatory scope.*passing evidence/i);
    assert.throws(() => command(review, 'approve'), /APPROVAL_BLOCKED/);
  }

  const stale = exampleReview();
  assert.match(present(stale).heading, /reapproval/i);
  assert.match(present(stale).message, /passing evidence/i);

  const full = command(stale, 'addEvidence', {
    requirementId: 'RQ-01',
    title: 'Fresh passing evidence',
    result: 'passed'
  });

  assert.equal(summarize(full).covered, summarize(full).mandatory);
  assert.match(present(full).message, /fresh explicit approval/i);

  const approved = command(full, 'approve');
  assert.equal(present(approved).heading, 'Current review approved');

  const rejected = command(full, 'reject', {
    note: 'Requires human reconsideration'
  });

  assert.equal(present(rejected).heading, 'Review rejected');

  const invalid = structuredClone(approved);
  invalid.evidence.push(structuredClone(invalid.evidence[0]));
  assert.equal(present(invalid).decisionBlocked, true);
});
