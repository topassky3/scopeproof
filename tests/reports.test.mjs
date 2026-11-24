import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';
import { buildReport } from '../src/features/reports/report-model.mjs';

function scenario() {
  let r = blankReview({ id: '1', key: 'ACD-1', summary: 'Test', projectId: '1', projectKey: 'ACD' });
  const add = (type, props) => { r = applyCommand(r, { type, expectedRevision: r.revision, ...props }, 'demo'); };
  add('addRequirement', { title: 'SSO and MFA' });
  add('addEvidence', { requirementId: 'RQ-01', title: 'v1 test', result: 'passed' });
  add('approve', { note: 'first' });
  add('publishVersion', { requirementId: 'RQ-01', title: 'SSO and MFA with timeout' });
  const stale = structuredClone(r);
  add('addEvidence', { requirementId: 'RQ-01', title: 'v2 test', result: 'passed' });
  const ready = structuredClone(r);
  add('approve', { note: 'second' });
  // Ensure unique decision timestamps even when the fixture runs in one millisecond.
  r.approvals[0].createdAt = r.events[2].createdAt = '2026-01-01T00:00:00Z';
  r.approvals[1].createdAt = r.events[6].createdAt = '2026-01-02T00:00:00Z';
  return { r, stale, ready };
}
const reportOf = r => buildReport(r, summarize(r));

test('Reports preserves historical evidence and both decision snapshots without mutating records', () => {
  const {r} = scenario(); const before = structuredClone(r); const summary = summarize(r); const sBefore = structuredClone(summary);
  const report = buildReport(r, summary);
  assert.equal(report.coveragePercent, 100);
  assert.equal(report.activeRevalidation, false);
  assert.equal(report.historyCounts.total, 7);
  assert.equal(report.historyCounts.revalidation, 1);
  assert.deepEqual(report.evidence.map(e => [e.id, e.applicability]), [['EV-102','current'],['EV-101','outdated']]);
  assert.deepEqual(report.decisions.map(d => d.detail.snapshot[0].evidenceId), ['EV-102','EV-101']);
  assert.deepEqual(r, before); assert.deepEqual(summary, sBefore);
});
test('Stale evidence is not current coverage and active revalidation is reported', () => {
  const {stale} = scenario(); const p = reportOf(stale);
  assert.equal(p.coveragePercent, 0); assert.equal(p.activeRevalidation, true);
  assert.equal(p.evidenceCounts.outdated, 1); assert.equal(p.evidenceCounts.current, 0);
});
test('Full coverage does not silently clear the need for a fresh approval', () => {
  const {ready} = scenario(); const p = reportOf(ready);
  assert.equal(p.coveragePercent, 100); assert.equal(p.activeRevalidation, true);
});
test('Empty review has no invented coverage, evidence or decisions', () => {
  const r = blankReview({ id: '1', key: 'ACD-1', summary: 'Empty', projectId: '1', projectKey: 'ACD' });
  const p = reportOf(r); assert.equal(p.coveragePercent, null);
  assert.deepEqual(p.evidence, []); assert.deepEqual(p.decisions, []); assert.equal(p.activeRevalidation, false);
});
test('Reports preserves ambiguity rather than attributing a decision note incorrectly', () => {
  const {r} = scenario(); r.approvals.unshift({...r.approvals[0], note: 'ambiguous'});
  const p = reportOf(r);
  assert.equal(p.decisions.at(-1).detail.kind, 'unavailable');
});
