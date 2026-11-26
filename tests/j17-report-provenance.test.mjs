import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, exampleReview, summarize, applyCommand } from '../src/domain.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
import { buildReportDiagnostic, canPublishReport, buildJsonReport } from '../src/features/reports/report-intelligence.js';
import { buildPdfDefinition, downloadReportPdf } from '../src/features/reports/pdf-report.mjs';
const at='2026-11-26T14:00:00Z';
const report=r=>buildReportDiagnostic(buildReviewIntelligence(r));
async function blocked(r,p,s=summarize(r)) {
  assert.equal(canPublishReport(r,s,p),false);
  assert.throws(()=>buildJsonReport(r,s,p,at),/REPORT_INSPECTION_REQUIRED/);
  assert.throws(()=>buildPdfDefinition(r,s,at,p),/REPORT_INSPECTION_REQUIRED/);
  await assert.rejects(downloadReportPdf(r,s,p),/REPORT_INSPECTION_REQUIRED/);
}
test('Provenance: valid detached review and summary preserve existing export schema',()=>{
  const r=exampleReview(),p=report(r),clone=structuredClone(r),s=summarize(clone);
  const before=structuredClone({r,p,s});
  assert.equal(canPublishReport(clone,s,p),true);
  const j=buildJsonReport(clone,s,p,at);
  assert.deepEqual(Object.keys(j),['generatedAt','review','coverage','reportIntelligence']);
  assert.deepEqual(Object.keys(j.reportIntelligence),['schemaVersion','diagnostic','comparison']);
  assert.deepEqual(j.reportIntelligence,p);
  assert.ok(buildPdfDefinition(clone,s,at,p).content.length);
  assert.deepEqual({r,p,s},before);
});
test('Provenance: A04 rejects other issue even if diagnostic itself is identical',async()=>{
  const r=exampleReview(),p=report(r),other={...r,issueId:'999',issueKey:'ACO-999'};
  assert.deepEqual(buildReviewIntelligence(other),p.diagnostic);
  await blocked(other,p);
});
test('Provenance: A05 rejects different evidence with equal revision and counts',async()=>{
  const r=exampleReview(),p=report(r),other=structuredClone(r);
  other.evidence[1].id='EV-999';other.approvals[0].snapshot[1].evidenceId='EV-999';
  assert.equal(summarize(other).covered,summarize(r).covered);
  await blocked(other,p);
});
test('Provenance: A06 rejects summary tampering without aggregate changes',async()=>{
  const r=exampleReview(),p=report(r),s=summarize(r);
  await blocked(r,p,{...s,rows:[]});
  await blocked(r,p,{...s,blockers:[]});
  const other=structuredClone(s);other.rows[0].title='Changed report wording';
  await blocked(r,p,other);
});
test('Provenance: detects in-place changes to identity, text and history',async()=>{
  for(const change of [r=>r.projectId='999',r=>r.summary='Changed summary',r=>r.events[0].description='Changed event',r=>r.evidence[0].url='https://example.com/other']) {
    const r=exampleReview(),p=report(r);change(r);await blocked(r,p);
  }
});
test('Provenance: detects mutations before and after report construction',async()=>{
  const r=exampleReview(),i=buildReviewIntelligence(r);i.plan.minimumActions=99;
  await blocked(r,buildReportDiagnostic(i));
  const p=report(r);p.comparison.avoidedOperations=99;await blocked(r,p);
  const p2=report(r);p2.diagnostic.plan.actions.length=0;await blocked(r,p2);
});
test('Provenance: copied or forged projections cannot acquire live provenance',async()=>{
  const r=exampleReview(),p=report(r);
  await blocked(r,structuredClone(p));
  await blocked(r,buildReportDiagnostic(structuredClone(p.diagnostic)));
  await blocked(r,null);
});
test('Provenance: object key order is irrelevant but array order is not',async()=>{
  const r=exampleReview(),p=report(r),reordered=Object.fromEntries(Object.entries(r).reverse());
  assert.equal(canPublishReport(reordered,summarize(reordered),p),true);
  reordered.events=[...reordered.events].reverse();await blocked(reordered,p);
});
test('Provenance: stale or inconsistent snapshots remain blocked',async()=>{
  const r=exampleReview(),p=report(r);
  const next=applyCommand(r,{type:'addEvidence',expectedRevision:r.revision,requirementId:'RQ-01',title:'Passing check',result:'passed'},'QA');
  await blocked(next,p);
  r.evidence.push(structuredClone(r.evidence[0]));await blocked(r,p);await blocked(r,report(r));
});
test('Provenance: empty scope still exports with undefined latest decision',()=>{
  const r=blankReview({id:'1',key:'T-1',summary:'Empty',projectId:'2',projectKey:'T'});
  const s=summarize(r),p=report(r);
  assert.equal(canPublishReport(r,s,p),true);
  assert.equal(buildJsonReport(r,s,p,at).reportIntelligence.diagnostic.impact.coveragePercent,null);
  assert.ok(buildPdfDefinition(r,s,at,p).content.length);
});
