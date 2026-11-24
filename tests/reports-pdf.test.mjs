import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, applyCommand, summarize } from '../src/domain.js';
import { buildPdfDefinition } from '../src/features/reports/pdf-report.mjs';
const generated = '2026-11-24T15:00:00Z';
const fixture = () => {
  let r = blankReview({id:'internal-issue-id',key:'ACD-1',summary:'Autenticación SSO',projectId:'internal-project-id',projectKey:'ACD'});
  const add = (type, props) => { r = applyCommand(r,{type,expectedRevision:r.revision,...props},'private-actor-id'); };
  add('addRequirement',{title:'SSO y MFA'});
  add('addEvidence',{requirementId:'RQ-01',title:'Prueba v1',result:'passed',url:'https://example.com/private-evidence'});
  add('approve',{note:'first'});
  add('publishVersion',{requirementId:'RQ-01',title:'SSO y MFA con expiración'});
  const stale = structuredClone(r);
  add('addEvidence',{requirementId:'RQ-01',title:'Prueba v2',result:'passed'});
  const ready = structuredClone(r);
  add('approve',{note:'second'});
  r.approvals[0].createdAt = r.events[2].createdAt = '2026-01-01T00:00:00Z';
  r.approvals[1].createdAt = r.events[6].createdAt = '2026-01-02T00:00:00Z';
  return {r,stale,ready};
};
const doc = r => buildPdfDefinition(r,summarize(r),generated);
const body = r => doc(r).content.map(x=>x.text).join('\n');
test('PDF projection preserves both snapshots and distinguishes outdated evidence',()=>{
  const {r}=fixture(); const before=structuredClone(r); const s=body(r);
  for(const value of ['Revision 6','Status: Approved','Mandatory coverage: 100%','EV-101 | RQ-01 v1','Applicability: outdated','EV-102 | RQ-01 v2','Applicability: current','RQ-01 v1 | EV-101','RQ-01 v2 | EV-102','Recorded revalidations: 1','expiración']) assert.ok(s.includes(value),value);
  assert.deepEqual(r,before);
});
test('PDF projection preserves required revalidation even with full coverage',()=>{
  const {stale,ready}=fixture(); assert.match(body(stale),/Mandatory coverage: 0%/); assert.match(body(ready),/Mandatory coverage: 100%/); assert.match(body(ready),/Active revalidation: Required/);
});
test('PDF projection excludes structured actor IDs, internal IDs and evidence URLs',()=>{
  const {r}=fixture(); const s=JSON.stringify(doc(r));
  for(const value of ['private-actor-id','internal-issue-id','internal-project-id','https://example.com/private-evidence']) assert.ok(!s.includes(value),value);
  assert.match(s,/Share only with authorized recipients/);
});
test('PDF projection handles empty review and ambiguous historical decisions',()=>{
  const empty=blankReview({id:'1',key:'ACD-2',summary:'Empty',projectId:'1',projectKey:'ACD'}); assert.match(body(empty),/Mandatory coverage: N\/A/); assert.match(body(empty),/No decision events recorded/);
  const {r}=fixture();r.approvals.unshift({...r.approvals[0],note:'ambiguous-private-note'});assert.match(body(r),/could not be uniquely matched/);assert.doesNotMatch(body(r),/ambiguous-private-note/);
});
test('PDF engine emits a real PDF with embedded fonts and accented text', async()=>{
  const [{default:pdfMake},{default:fonts}]=await Promise.all([import('pdfmake/build/pdfmake.js'),import('pdfmake/build/vfs_fonts.js')]);
  pdfMake.addVirtualFileSystem(fonts);
  const bytes=await pdfMake.createPdf(doc(fixture().r)).getBuffer();
  assert.equal(Buffer.from(bytes).subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(bytes.length>1000);
});
