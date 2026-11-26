import test from 'node:test';
import assert from 'node:assert/strict';
import { blankReview, exampleReview, applyCommand, summarize } from '../src/domain.js';
import { analyzeReviewImpact } from '../src/change-impact.js';
import { planRevalidation } from '../src/revalidation-planner.js';
import { buildReviewIntelligence } from '../src/shared/review-intelligence.js';
// Frozen J17.7C3 reference, intentionally retains the original quadratic scans.
function matchesMandatorySnapshot(rows, snapshot) {
  const mandatory = rows.filter(r => r.mandatory);
  if (!mandatory.length || !Array.isArray(snapshot) || snapshot.length !== mandatory.length) return false;
  const byId = new Map(mandatory.map(r => [r.id, r]));
  if (byId.size !== mandatory.length) return false;
  const seen = new Set();
  for (const entry of snapshot) {
    if (!entry || typeof entry.requirementId !== 'string' || !entry.requirementId ||
        typeof entry.evidenceId !== 'string' || !entry.evidenceId || seen.has(entry.requirementId)) return false;
    const row = byId.get(entry.requirementId);
    if (!row || row.state !== 'satisfied' || row.version !== entry.version ||
        row.latestEvidence?.id !== entry.evidenceId) return false;
    seen.add(entry.requirementId);
  }
  return seen.size === byId.size;
}

function referenceSummary(review) {
  const requirements = review.requirements ?? [];
  const evidence = review.evidence ?? [];
  const mandatory = requirements.filter(r => r.mandatory);
  const rows = requirements.map(r => {
    const matching = evidence.filter(e => e.requirementId === r.id && e.version === r.version).reverse();
    const latest = matching[0];
    const stale = evidence.some(e => e.requirementId === r.id && e.version < r.version);
    return {...r, latestEvidence: latest ?? null,
      state: latest ? (latest.result === 'passed' ? 'satisfied' : 'failed') : stale ? 'stale' : 'missing'};
  });
  const covered = rows.filter(r => r.mandatory && r.state === 'satisfied').length;
  const latestApproval = review.approvals?.at(-1);
  const snapshotMatches = latestApproval?.type === 'approved' && covered === mandatory.length &&
    matchesMandatorySnapshot(rows, latestApproval.snapshot);
  let status = 'pending';
  if (latestApproval?.type === 'rejected') status = 'rejected';
  else if (latestApproval?.type === 'approved') status = snapshotMatches ? 'approved' : 'revalidation';
  else if (requirements.length) status = mandatory.length > 0 && covered === mandatory.length ? 'ready' : 'in-review';
  return { rows, mandatory: mandatory.length, covered, status,
    blockers: rows.filter(r => r.mandatory && r.state !== 'satisfied'), latestApproval };
}


const cmd=(r,type,props={})=>applyCommand(r,{type,expectedRevision:r.revision,...props},'QA');
function parity(r) {
  const before=structuredClone(r);
  const expected=referenceSummary(r), actual=summarize(r);
  assert.deepEqual(actual,expected);
  for (let i=0;i<actual.rows.length;i++) assert.equal(actual.rows[i].latestEvidence,expected.rows[i].latestEvidence);
  assert.deepEqual(r,before);
}
test('Performance parity: all 81 combinations of evidence order and version state',()=>{
  for(let seed=0;seed<81;seed++) {
    let r=exampleReview(), mask=seed;
    for(const q of r.requirements) {
      const state=mask%3;mask=Math.floor(mask/3);
      if(state===0) r=cmd(r,'addEvidence',{requirementId:q.id,title:'Passing record',result:'passed'});
      if(state===1) r=cmd(r,'addEvidence',{requirementId:q.id,title:'Failed record',result:'failed'});
      if(state===2) r=cmd(r,'publishVersion',{requirementId:q.id,title:'Revised '+q.id});
    }
    if(seed>=27&&seed<54)r=cmd(r,'reject',{note:'Human decision'});
    if(seed>=54) r=cmd(r,'addRequirement',{title:'Optional requirement',mandatory:false});
    parity(r);
    const projection=buildReviewIntelligence(r);
    assert.deepEqual(projection.impact,analyzeReviewImpact(r));
    assert.deepEqual(projection.plan,planRevalidation(r));
  }
});
test('Performance parity: latest insertion wins regardless of timestamp or version order',()=>{
  const r=exampleReview();const e=structuredClone(r.evidence[0]);
  r.evidence.push({...e,id:'EV-900',version:2,result:'passed',createdAt:'1900-01-01'}, {...e,id:'EV-901',version:1,result:'failed',createdAt:'2100-01-01'});
  parity(r);assert.equal(summarize(r).rows[0].latestEvidence.id,'EV-900');
  r.evidence.push({...e,id:'EV-902',version:2,result:'failed',createdAt:'1800-01-01'});
  parity(r);assert.equal(summarize(r).rows[0].state,'failed');
});
test('Performance parity: missing, future, stale, optional, empty and sparse evidence',()=>{
  const r=exampleReview(); r.evidence=[{requirementId:'RQ-01',version:3,result:'passed',id:'future'},, {requirementId:'RQ-02',version:0,result:'passed',id:'old'}];
  r.requirements[2].mandatory=false;parity(r);
  parity(blankReview({id:'1',key:'T-1',summary:'Empty',projectId:'1',projectKey:'T'}));
});
test('Performance parity: legacy coercion and duplicate IDs preserve low-level projection',()=>{
  const r=exampleReview(); r.evidence[0].version='1';r.requirements.push(structuredClone(r.requirements[0]));parity(r);
  r.evidence[0].version=1;parity(r);
  assert.equal(buildReviewIntelligence(r).kind,'unavailable');
});
test('Performance parity: 1000 requirements with mixed versions and shuffled evidence',()=>{
  const r=blankReview({id:'1',key:'T-1',summary:'Large synthetic',projectId:'1',projectKey:'T'});
  for(let i=0;i<1000;i++){
    const id='RQ-'+i,version=1+i%3;r.requirements.push({id,title:'Requirement '+i,version,mandatory:i%5!==0,versions:[]});
    if(i%7!==0)r.evidence.unshift({id:'EV-'+i,requirementId:id,version:i%4===0?version-1:version,result:i%3===0?'failed':'passed'});
  }
  parity(r);
});
test('Performance parity: invalid records and allocation limits still suppress projection',()=>{
  const r=exampleReview();r.requirements.push(null);assert.equal(buildReviewIntelligence(r).kind,'unavailable');
  const capped=exampleReview();capped.revision=Number.MAX_SAFE_INTEGER;assert.equal(buildReviewIntelligence(capped).kind,'unavailable');
});
