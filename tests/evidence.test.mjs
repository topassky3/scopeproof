import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, exampleReview, summarize } from '../src/domain.js';
import { buildEvidenceRows, evidenceMetrics, filterEvidenceRows } from '../src/features/evidence/evidence-model.mjs';

test('evidence view separates passing test result from outdated applicability', () => {
  const rows = buildEvidenceRows(exampleReview());
  assert.equal(rows.length, 3);
  const oldPass = rows.find(row => row.requirementId === 'RQ-01');
  assert.equal(oldPass.result, 'passed');
  assert.equal(oldPass.applicability, 'outdated');
  assert.equal(oldPass.currentVersion, 2);
  assert.deepEqual(evidenceMetrics(rows), { total:3, current:2, outdated:1, failedCurrent:0 });
});

test('evidence search, applicability and result filters use only supplied review records', () => {
  const rows = buildEvidenceRows(exampleReview());
  assert.equal(filterEvidenceRows(rows, 'EV-101').length, 1);
  assert.equal(filterEvidenceRows(rows, 'Sessions').length, 1);
  assert.equal(filterEvidenceRows(rows, 'RQ-01', 'outdated', 'passed').length, 1);
  assert.equal(filterEvidenceRows(rows, '', 'outdated', 'failed').length, 0);
  assert.equal(filterEvidenceRows(rows, 'invented').length, 0);
});

test('new passing evidence covers v2 while older passed evidence stays outdated', () => {
  const review = exampleReview();
  const updated = applyCommand(review, {type:'addEvidence', expectedRevision:review.revision, requirementId:'RQ-01', title:'MFA test v2', result:'passed'}, 'QA');
  const rows = buildEvidenceRows(updated);
  assert.equal(rows.find(row => row.title === 'MFA test v2').applicability, 'current');
  assert.equal(rows.find(row => row.title === 'SSO login test').applicability, 'outdated');
  assert.equal(summarize(updated).covered, 3);
  assert.equal(summarize(updated).status, 'revalidation');
});

test('most recent failure supersedes earlier passing test at the same version', () => {
  let review = exampleReview();
  review = applyCommand(review, {type:'addEvidence',expectedRevision:review.revision, requirementId:'RQ-02',title:'Second pass',result:'passed'},'QA');
  review = applyCommand(review, {type:'addEvidence',expectedRevision:review.revision, requirementId:'RQ-02',title:'Latest failure',result:'failed'},'QA');
  const rows = buildEvidenceRows(review);
  assert.equal(rows.find(row => row.title === 'Second pass').applicability, 'superseded');
  assert.equal(rows.find(row => row.title === 'Latest failure').applicability, 'current');
  assert.equal(evidenceMetrics(rows).failedCurrent, 1);
  assert.ok(summarize(review).blockers.some(row => row.id === 'RQ-02' && row.state === 'failed'));
});

test('publishing a new version turns previously current evidence outdated without deleting it', () => {
  const review = exampleReview();
  const next = applyCommand(review,{type:'publishVersion',expectedRevision:review.revision, requirementId:'RQ-02', title:'Sessions expire after 15 minutes'}, 'QA');
  const oldRow = buildEvidenceRows(next).find(row => row.requirementId === 'RQ-02');
  assert.equal(oldRow.applicability, 'outdated');
  assert.equal(oldRow.result, 'passed');
  assert.equal(next.evidence.length, review.evidence.length);
});

test('missing requirement references do not falsely count as current', () => {
  const rows = buildEvidenceRows({requirements:[],evidence:[{id:'EV-X',requirementId:'RQ-X',version:1,title:'Unmatched',result:'passed'}]});
  assert.equal(rows[0].applicability, 'unknown');
  assert.equal(evidenceMetrics(rows).current, 0);
});


test('Evidence statuses do not misreport empty reviews or revalidation as success', () => {
  const source = readFileSync(new URL('../src/features/evidence/EvidencePage.tsx', import.meta.url), 'utf8');
  assert.match(source, /summary\.mandatory === 0/);
  assert.match(source, /summary\.status === 'revalidation'/);
  assert.match(source, /const needsReview = summary\.blockers\.length > 0/);
});

test('Evidence preview warning does not appear in deployed Jira', () => {
  const source = readFileSync(new URL('../src/features/evidence/EvidencePage.tsx', import.meta.url), 'utf8');
  assert.match(source, /\{import\.meta\.env\.DEV && <p className="ev-preview-help">/);
});

test('Evidence details track filtered records rather than a hidden selection', () => {
  const source = readFileSync(new URL('../src/features/evidence/EvidencePage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const selected = matches\.find\(row => row\.id === selectedId\) \?\? matches\[0\]/);
  const rows = buildEvidenceRows(exampleReview());
  const matches = filterEvidenceRows(rows, 'no-record-like-this');
  assert.equal(matches.length, 0);
});

test('Evidence keeps the historical requirement description for the version actually tested', () => {
  const review = exampleReview();
  const rows = buildEvidenceRows(review);
  const old = rows.find(row => row.requirementId === 'RQ-01' && row.version === 1);
  assert.equal(old.requirementTitle, 'Users can sign in using SSO');
  assert.equal(old.currentRequirementTitle, 'SSO requires mandatory MFA');
  const current = rows.find(row => row.requirementId === 'RQ-02' && row.version === 1);
  assert.equal(current.requirementTitle, 'Sessions expire after 30 minutes');
});

test('Evidence does not invent historical wording when a legacy version record is absent', () => {
  const rows = buildEvidenceRows({
    requirements: [{id:'RQ-01',version:2,title:'Current requirement title',mandatory:true}],
    evidence: [{id:'EV-101',requirementId:'RQ-01',version:1,title:'old test',result:'passed'}],
  });
  assert.equal(rows[0].requirementTitle, 'Historical description unavailable');
  assert.equal(rows[0].currentRequirementTitle, 'Current requirement title');
});

test('Evidence target stays independent of selected history and validates current requirements', () => {
  const source = readFileSync(new URL('../src/features/evidence/EvidencePage.tsx', import.meta.url), 'utf8');
  const selectRow = source.match(/function selectRow\(row: EvidenceViewRow\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(selectRow, 'Evidence row selection handler must exist');
  assert.match(selectRow, /setSelectedId\(row\.id\)/);
  assert.doesNotMatch(selectRow, /setRequirementId/);
  assert.match(source, /review\.requirements\.some\(row => row\.id === requirementId\)/);
  assert.match(source, /disabled=\{!targetRequirementId\}/);
});

test('local preview listens for cross-tab updates and cleans up its listener', () => {
  const source = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /window\.addEventListener\('storage', onStorage\)/);
  assert.match(source, /window\.removeEventListener\('storage', onStorage\)/);
  assert.match(source, /event\.key !== key/);
  assert.match(source, /incoming\.revision > current\.revision/);
});

test('local preview rejects stale writes before applying commands', () => {
  const source = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /stored\.revision !== review\.revision/);
  assert.match(source, /setReview\(stored\)/);
  assert.match(source, /Another tab updated this review/);
  assert.match(source, /updated=applyCommand\(review,command,'local-preview'\)/);
});

test('local preview editor rejects a form opened before a cross-tab revision change', () => {
  const source = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /setEditorRevision\(review\?\.revision \?\? null\)/);
  assert.match(source, /preview && editorRevision !== review\.revision/);
  assert.match(source, /This form was opened before another tab changed the review/);
  assert.match(source, /Close it and reopen to verify the latest data/);
});

test('approval action is disabled when there are zero mandatory requirements', () => {
  const source = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabled=\{busy \|\| summary\.mandatory === 0 \|\| summary\.blockers\.length > 0 \|\| summary\.status === 'approved'\}/);
});

test('approval banner distinguishes empty, revalidation, approved and ready states', () => {
  const source = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /summary\.mandatory === 0 \? 'Add at least one mandatory requirement before approval\.'/);
  assert.match(source, /summary\.status === 'revalidation' \? 'A previous approval requires revalidation\.'/);
  assert.match(source, /summary\.status === 'approved' \? 'This review is approved for the current evidence snapshot\.'/);
});

test('Requirements details follow filtered results instead of hidden selection', () => {
  const source = readFileSync(new URL('../src/features/requirements/RequirementsPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const selected = matching\.find\(row => row\.id === selectedId\) \?\? matching\[0\]/);
  assert.match(source, /const evidence = selected \? evidenceOverview\(selected, review\.evidence \?\? \[\]\) : null/);
});
