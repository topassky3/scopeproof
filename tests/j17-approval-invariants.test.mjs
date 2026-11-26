import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';

const create = () => blankReview({
  id: 'test', key: 'TEST-1', summary: 'J17 invariant test',
  projectId: 'test-project', projectKey: 'TEST'
});
const cmd = (r, type, fields = {}) => applyCommand(r, {
  type, expectedRevision: r.revision, ...fields
}, 'test-actor');
const add = (r, title, mandatory = true) => cmd(r, 'addRequirement', {title, mandatory});
const evidence = (r, requirementId, result = 'passed') => cmd(r, 'addEvidence', {
  requirementId, title: 'Experimental evidence', result
});
const change = (r, requirementId) => cmd(r, 'publishVersion', {
  requirementId, title: 'Updated requirement title'
});
const revalidations = r => r.events.filter(e => e.type === 'approval-revalidation').length;
const approved = (optional = false) => {
  let r = add(create(), 'First mandatory requirement');
  if (optional) r = add(r, 'Optional requirement', false);
  return cmd(evidence(r, 'RQ-01'), 'approve');
};

test('H01: optional-only review is not ready or approved', () => {
  const r = add(create(), 'Optional requirement', false);
  const s = summarize(r);
  assert.equal(s.mandatory, 0);
  assert.throws(() => cmd(r, 'approve'), /APPROVAL_BLOCKED/);
  assert.ok(!['ready', 'approved'].includes(s.status), `Unexpected status: ${s.status}`);
});

test('H02: optional change retains approval without a false revalidation event', () => {
  const r = approved(true);
  const updated = change(r, 'RQ-02');
  assert.equal(summarize(updated).status, 'approved');
  assert.equal(revalidations(updated) - revalidations(r), 0);
  assert.deepEqual(updated.approvals, r.approvals);
});

test('H03: failed mandatory evidence invalidates approval and records the transition', () => {
  const r = approved();
  const updated = evidence(r, 'RQ-01', 'failed');
  assert.equal(summarize(updated).status, 'revalidation');
  assert.equal(summarize(updated).blockers.length, 1);
  assert.equal(revalidations(updated) - revalidations(r), 1);
  assert.deepEqual(updated.approvals, r.approvals);
});

test('H04: duplicate snapshot cannot approve a review with an uncovered mandatory requirement', () => {
  let r = add(create(), 'First mandatory requirement');
  r = add(r, 'Second mandatory requirement');
  r = evidence(evidence(r, 'RQ-01'), 'RQ-02');
  r = cmd(r, 'approve');
  assert.equal(summarize(r).status, 'approved');
  // Deliberately inconsistent synthetic record, not a normal Jira command.
  const corrupted = structuredClone(r);
  const snapshot = corrupted.approvals.at(-1).snapshot;
  snapshot[1] = structuredClone(snapshot[0]);
  // Mutations of corrupt stored records now fail closed. Preserve the original
  // read-only verification case by constructing the corrupted state explicitly.
  const before = structuredClone(corrupted);
  assert.throws(() => evidence(corrupted, 'RQ-02', 'failed'), /REVIEW_INSPECTION_REQUIRED/);
  assert.deepEqual(corrupted, before);
  const updated = evidence(r, 'RQ-02', 'failed');
  updated.approvals.at(-1).snapshot = structuredClone(snapshot);
  assert.equal(summarize(updated).covered, 1);
  assert.equal(summarize(updated).blockers.length, 1);
  assert.equal(summarize(updated).status, 'revalidation');
});

test('Control A: mandatory version change retains history and emits one revalidation', () => {
  const r = approved();
  const updated = change(r, 'RQ-01');
  assert.equal(summarize(updated).status, 'revalidation');
  assert.equal(revalidations(updated) - revalidations(r), 1);
  assert.deepEqual(updated.approvals, r.approvals);
  assert.deepEqual(updated.evidence, r.evidence);
});

test('Control B: full coverage does not replace fresh explicit approval', () => {
  const r = approved();
  const changed = change(r, 'RQ-01');
  const covered = evidence(changed, 'RQ-01');
  assert.equal(summarize(covered).covered, 1);
  assert.equal(summarize(covered).status, 'revalidation');
  const renewed = cmd(covered, 'approve');
  assert.equal(summarize(renewed).status, 'approved');
  assert.equal(renewed.approvals.length, 2);
  assert.deepEqual(renewed.approvals[0], r.approvals[0]);
});

// Additional boundary cases for the same invariants.
test('H04b: duplicate snapshot is invalid even with full coverage', () => {
  let r = add(add(create(), 'First mandatory requirement'), 'Second mandatory requirement');
  r = cmd(evidence(evidence(r, 'RQ-01'), 'RQ-02'), 'approve');
  const s = r.approvals.at(-1).snapshot;
  s[1] = structuredClone(s[0]);
  assert.equal(summarize(r).covered, 2);
  assert.equal(summarize(r).status, 'revalidation');
});

test('H04c: missing, null, sparse and malformed snapshots fail closed', () => {
  const r = approved();
  for (const snapshot of [undefined, null, {}, [], [null], Array(1), [{requirementId:'RQ-01',version:1}]]) {
    const copy = structuredClone(r);
    copy.approvals.at(-1).snapshot = snapshot;
    assert.equal(summarize(copy).status, 'revalidation');
  }
});

test('H04d: optional requirement cannot substitute for a mandatory snapshot entry', () => {
  const r = evidence(approved(true), 'RQ-02');
  r.approvals.at(-1).snapshot = [{requirementId:'RQ-02',version:1,evidenceId:'EV-102'}];
  assert.equal(summarize(r).covered, 1);
  assert.equal(summarize(r).status, 'revalidation');
});

test('Adding mandatory scope invalidates approval and records exactly one transition', () => {
  const original = approved();
  const updated = add(original, 'Another mandatory requirement');
  assert.equal(summarize(updated).status, 'revalidation');
  assert.equal(revalidations(updated) - revalidations(original), 1);
  assert.equal(updated.revision, original.revision + 1);
  assert.deepEqual(updated.approvals, original.approvals);
  assert.deepEqual(updated.events.slice(0, original.events.length), original.events);
  const covered = evidence(updated, 'RQ-02');
  assert.equal(revalidations(covered), revalidations(updated));
  assert.equal(summarize(covered).status, 'revalidation');
});

test('New passing mandatory evidence invalidates the old snapshot at full coverage', () => {
  const r = approved();
  const updated = evidence(r, 'RQ-01');
  assert.equal(summarize(updated).covered, 1);
  assert.equal(summarize(updated).status, 'revalidation');
  assert.equal(revalidations(updated) - revalidations(r), 1);
  const failed = evidence(updated, 'RQ-01', 'failed');
  assert.equal(revalidations(failed), revalidations(updated));
  assert.deepEqual(failed.approvals, r.approvals);
});

test('Adding optional scope or optional evidence leaves approval and audit transition count intact', () => {
  const r = approved();
  const expanded = add(r, 'Optional requirement', false);
  const updated = evidence(expanded, 'RQ-02', 'failed');
  assert.equal(summarize(updated).status, 'approved');
  assert.equal(revalidations(updated), revalidations(r));
  assert.deepEqual(updated.approvals, r.approvals);
});
