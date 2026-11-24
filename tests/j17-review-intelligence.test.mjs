import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, exampleReview, applyCommand } from '../src/domain.js';
import { analyzeReviewImpact } from '../src/change-impact.js';
import { planRevalidation } from '../src/revalidation-planner.js';
import { buildReviewIntelligence as build } from '../src/shared/review-intelligence.js';

const cmd = (r, type, fields = {}) => applyCommand(r, { type, expectedRevision: r.revision, ...fields }, 'test');
const pass = r => cmd(r, 'addEvidence', { requirementId: 'RQ-01', title: 'Current evidence', result: 'passed' });
const covered = () => pass(exampleReview());

test('Intelligence: the demo projects the same revision, diagnosis and minimal plan', () => {
  const r = exampleReview(), original = structuredClone(r), view = build(r);
  assert.equal(view.kind, 'available');
  assert.equal(view.revision, 8);
  assert.deepEqual(view.impact, analyzeReviewImpact(r));
  assert.deepEqual(view.plan, planRevalidation(r));
  assert.equal(view.plan.minimumActions, 2);
  assert.equal(view.plan.retainedEvidence.length, 2);
  assert.deepEqual(build(r), view);
  assert.deepEqual(r, original);
});
test('Intelligence: full coverage still exposes the need for explicit reapproval', () => {
  const view = build(covered());
  assert.equal(view.kind, 'available');
  assert.equal(view.impact.coveragePercent, 100);
  assert.equal(view.impact.status, 'revalidation');
  assert.deepEqual(view.plan.actions, [{ type: 'request-explicit-approval' }]);
});
test('Intelligence: valid approval reports zero required operations', () => {
  const view = build(cmd(covered(), 'approve'));
  assert.equal(view.kind, 'available');
  assert.equal(view.impact.status, 'approved');
  assert.equal(view.plan.disposition, 'no-action');
  assert.equal(view.plan.minimumActions, 0);
});
test('Intelligence: rejection is distinguished from an actionable plan', () => {
  const view = build(cmd(covered(), 'reject', { note: 'Human review required' }));
  assert.equal(view.kind, 'available');
  assert.equal(view.impact.status, 'rejected');
  assert.equal(view.plan.disposition, 'human-review');
  assert.equal(view.plan.minimumActions, null);
  assert.deepEqual(view.plan.actions, []);
});
test('Intelligence: empty review has no percentage or automatic approval plan', () => {
  const view = build(blankReview({ id: '1', key: 'TEST-1', summary: 'Empty', projectId: '1', projectKey: 'TEST' }));
  assert.equal(view.kind, 'available');
  assert.equal(view.impact.coveragePercent, null);
  assert.equal(view.plan.disposition, 'define-mandatory-scope');
  assert.equal(view.plan.minimumActions, null);
});
test('Intelligence: malformed input or ambiguous records cannot present a trusted diagnosis', () => {
  const ambiguous = cmd(covered(), 'approve');
  ambiguous.evidence.push(structuredClone(ambiguous.evidence[0]));
  const badSnapshot = exampleReview();
  badSnapshot.approvals.at(-1).snapshot = null;
  for (const r of [null, {}, ambiguous, badSnapshot]) {
    const view = build(r);
    assert.equal(view.kind, 'unavailable');
    assert.equal(view.impact, null);
    assert.equal(view.plan.disposition, 'inspect-records');
    assert.ok(view.plan.issues.length);
    assert.equal(view.plan.minimumActions, null);
    assert.deepEqual(view.plan.actions, []);
  }
});
test('Intelligence: ID allocation collision suppresses diagnosis even with non-null domain status', () => {
  const r = exampleReview();
  // Keep references consistent, but occupy the identifier next allocated by addEvidence.
  r.evidence[0].id = 'EV-104';
  r.approvals.at(-1).snapshot[0].evidenceId = 'EV-104';
  const view = build(r);
  assert.equal(view.kind, 'unavailable');
  assert.equal(view.impact, null);
  assert.equal(view.plan.status, 'revalidation');
  assert.deepEqual(view.plan.issues, ['EVIDENCE_ID_ALLOCATION_COLLISION']);
});
test('Intelligence: recomputing after a command uses the new revision, not a cached plan', () => {
  const r = exampleReview(), before = build(r), after = build(pass(r));
  assert.equal(after.revision, before.revision + 1);
  assert.equal(before.plan.minimumActions, 2);
  assert.equal(after.plan.minimumActions, 1);
});
