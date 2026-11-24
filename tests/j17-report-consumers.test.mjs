import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, blankReview, exampleReview, summarize } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic, buildJsonReport, canPublishReport } from '../src/features/reports/report-intelligence.js';
const generated = '2026-11-24T21:00:00Z';
const report = r => buildReportDiagnostic(buildReviewIntelligence(r));
const json = r => buildJsonReport(r, summarize(r), report(r), generated);
const command = (r, type, props = {}) => applyCommand(r, {type, expectedRevision:r.revision, ...props}, 'QA');
const pass = r => command(r, 'addEvidence', {requirementId:'RQ-01', title:'Current passing test', result:'passed'});
const empty = () => blankReview({id:'1',key:'T-1',summary:'Empty',projectId:'2',projectKey:'T'});

test('Report consumers: JSON retains legacy fields and the exact shared diagnostic', () => {
  const r=exampleReview(), before=structuredClone(r), s=summarize(r), p=report(r), value=json(r);
  assert.deepEqual(value, {generatedAt:generated,review:r,coverage:s,reportIntelligence:p});
  assert.deepEqual(JSON.parse(JSON.stringify(value)),value);
  assert.deepEqual(r,before);
  assert.equal(value.reportIntelligence.comparison.avoidedOperations,2);
});
test('Report consumers: exported snapshot is detached from inputs', () => {
  const r=exampleReview(), s=summarize(r), p=report(r), value=buildJsonReport(r,s,p,generated), before=structuredClone(value);
  r.requirements[0].title='Changed'; s.rows.length=0; p.diagnostic.plan.actions.length=0;
  assert.deepEqual(value,before);
});
test('Report consumers: full coverage still requests explicit approval', () => {
  const r=pass(exampleReview()), value=json(r);
  assert.equal(value.coverage.status,'revalidation');
  assert.equal(value.reportIntelligence.diagnostic.impact.coveragePercent,100);
  assert.deepEqual(value.reportIntelligence.diagnostic.plan.actions,[{type:'request-explicit-approval'}]);
});
test('Report consumers: valid approval and rejection have no recovery comparison', () => {
  const r=pass(exampleReview());
  const approved=json(command(r,'approve')), rejected=json(command(r,'reject',{note:'Human review required'}));
  assert.equal(approved.reportIntelligence.diagnostic.plan.minimumActions,0);
  assert.equal(rejected.reportIntelligence.diagnostic.plan.minimumActions,null);
  assert.equal(approved.reportIntelligence.comparison,null); assert.equal(rejected.reportIntelligence.comparison,null);
});
test('Report consumers: empty and optional-only reviews remain exportable without invented coverage', () => {
  for(const r of [empty(),command(empty(),'addRequirement',{title:'Optional check',mandatory:false})]) {
    const value=json(r); assert.equal(value.reportIntelligence.diagnostic.impact.coveragePercent,null);
    assert.equal(value.reportIntelligence.comparison,null);
  }
});
test('Report consumers: ambiguous records block ordinary reports and JSON', () => {
  const r=exampleReview(); r.evidence.push(structuredClone(r.evidence[0])); const s=summarize(r), p=report(r);
  assert.equal(canPublishReport(r,s,p),false);
  assert.throws(()=>buildJsonReport(r,s,p,generated),/REPORT_INSPECTION_REQUIRED/);
});
test('Report consumers: stale revision and mismatched summary block publication', () => {
  const r=exampleReview(), updated=pass(r), s=summarize(r), p=report(r);
  for(const [review,summary] of [[updated,summarize(updated)],[r,{...s,status:'approved'}],[r,{...s,covered:0}],[r,{...s,mandatory:10}]]) {
    assert.equal(canPublishReport(review,summary,p),false);
    assert.throws(()=>buildJsonReport(review,summary,p,generated),/REPORT_INSPECTION_REQUIRED/);
  }
});
test('Report consumers: web and JSON use one diagnostic and block unavailable publication', () => {
  const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
  const page=readFileSync(new URL('../src/features/reports/ReportsPage.tsx',import.meta.url),'utf8');
  assert.match(app,/buildReportDiagnostic\(intelligence\)/);
  assert.match(app,/buildJsonReport\(review, summary, reportDiagnostic,/);
  assert.match(app,/<ReportsPage review=\{review\} summary=\{summary\} reportDiagnostic=\{reportDiagnostic!\}/);
  assert.match(app,/disabled=\{busy \|\| !reportPublishable\} onClick=\{exportReport\}/);
  assert.match(page,/diagnostic.kind !== 'available' \|\| !canPublishReport/);
  assert.match(page,/return <AvailableReports/);
  assert.match(page,/const comparison = reportDiagnostic.comparison/);
  assert.match(page,/Not measured time or financial savings/);
  assert.match(page,/downloadReportPdf\(review, summary, reportDiagnostic\)/);
});
