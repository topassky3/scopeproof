import test from 'node:test';
import assert from 'node:assert/strict';
import {blankReview,applyCommand} from '../src/domain.js';
import {historyRows,historyMetrics,filterHistory,eventDetail} from '../src/features/history/history-model.mjs';
function fixture(){
 let r=blankReview({id:'1',key:'ACD-1',summary:'Test',projectId:'1',projectKey:'ACD'});
 const add=(type,props)=>{r=applyCommand(r,{type,expectedRevision:r.revision,...props},'demo')};
 add('addRequirement',{title:'Require SSO'});add('addEvidence',{requirementId:'RQ-01',title:'SSO test',result:'passed'});
 add('approve',{note:'First approved'});add('publishVersion',{requirementId:'RQ-01',title:'Require SSO and MFA'});
 add('addEvidence',{requirementId:'RQ-01',title:'MFA test',result:'passed'});
 // Distinct timestamps for decisions so the legacy matching is unambiguous.
 add('approve',{note:'Second approved'});
 r.approvals[0].createdAt=r.events[2].createdAt='2026-01-01T00:00:00.000Z';
 r.approvals[1].createdAt=r.events[6].createdAt='2026-01-02T00:00:00.000Z';
 return r;
}
test('Timeline preserves all seven events, reverse insertion order and original data',()=>{
 const r=fixture(),before=structuredClone(r),rows=historyRows(r);
 assert.deepEqual(rows.map(x=>x.event.id),r.events.map(x=>x.id).reverse());
 assert.deepEqual(historyMetrics(rows),{total:7,requirements:2,evidence:2,decisions:2,revalidation:1});
 assert.deepEqual(r,before);
});
test('History filters event category and visible actor name without raw account IDs',()=>{
 const r=fixture(),rows=historyRows(r);
 assert.equal(filterHistory(rows,'MFA').length,0); // event description does not contain evidence title
 assert.equal(filterHistory(rows,'RQ-01','evidence').length,2);
 assert.equal(filterHistory(rows,'Demo user','decisions').length,2);
 assert.equal(filterHistory(rows,'nonexistent').length,0);
});
test('Historical requirement diff uses actual stored versions, not current wording',()=>{
 const r=fixture(),detail=eventDetail(r,r.events[3]);
 assert.deepEqual(detail,{kind:'requirement',requirementId:'RQ-01',version:2,title:'Require SSO and MFA',previousTitle:'Require SSO'});
 assert.equal(eventDetail(r,r.events[0]).title,'Require SSO');
});
test('Historical evidence keeps exact version and result',()=>{
 const r=fixture(),detail=eventDetail(r,r.events[1]);
 assert.equal(detail.kind,'evidence');assert.equal(detail.version,1);assert.equal(detail.title,'SSO test');
});
test('Decision details use the original snapshot and note, not latest approval',()=>{
 const r=fixture();
 assert.deepEqual(eventDetail(r,r.events[2]),{kind:'decision',note:'First approved',snapshot:[{requirementId:'RQ-01',version:1,evidenceId:'EV-101'}]});
 assert.equal(eventDetail(r,r.events[6]).snapshot[0].version,2);
});
test('Ambiguous legacy decisions and missing version descriptions never invent detail',()=>{
 const r=fixture();r.approvals.push({...r.approvals[0],note:'Another decision'});
 assert.deepEqual(eventDetail(r,r.events[2]),{kind:'unavailable'});
 r.requirements[0].versions=[];assert.deepEqual(eventDetail(r,r.events[3]),{kind:'unavailable'});
});
test('Rejection reason belongs to matching rejection; unknown events stay visible',()=>{
 let r=fixture();r=applyCommand(r,{type:'reject',expectedRevision:r.revision,note:'Missing signed report'},'demo');
 assert.equal(eventDetail(r,r.events.at(-1)).note,'Missing signed report');
 r.events.push({id:'unknown',type:'future-event',description:'Future event',actor:'demo',createdAt:''});
 assert.equal(filterHistory(historyRows(r),'','other').length,1);
});
test('Empty audit and unmatched evidence are handled safely',()=>{
 assert.equal(historyRows({events:[]}).length,0);
 const r=fixture();r.evidence=[];assert.deepEqual(eventDetail(r,r.events[1]),{kind:'unavailable'});
});


// J16.1C compatibility regressions
import { buildHistoryEntries } from '../src/features/history/history-model.mjs';

function legacyRejectionFixture() {
  const event = {
    id: 'legacy-1',
    description: 'Review rejected',
    actor: 'demo',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  return {
    events: [event],
    approvals: [{
      type: 'rejected',
      actor: event.actor,
      createdAt: event.createdAt,
      note: 'Missing evidence',
      snapshot: []
    }]
  };
}

test('Lopera legacy rejection remains available in both consumers', () => {
  const r = legacyRejectionFixture();
  const before = structuredClone(r);

  assert.equal(buildHistoryEntries(r)[0].rejectionReason,
    'Missing evidence');

  assert.equal(eventDetail(r, r.events[0]).note,
    'Missing evidence');

  assert.equal(historyRows(r)[0].category, 'decisions');
  assert.deepEqual(r, before);
});

test('Both consumers refuse ambiguous rejection records', () => {
  const r = legacyRejectionFixture();

  r.approvals.push({
    ...r.approvals[0],
    note: 'Different reason'
  });

  assert.equal(buildHistoryEntries(r)[0].rejectionReason, null);
  assert.deepEqual(eventDetail(r, r.events[0]),
    { kind: 'unavailable' });
});

test('A decision cannot be attributed to multiple matching events', () => {
  const r = legacyRejectionFixture();

  r.events.push({
    ...r.events[0],
    id: 'legacy-2'
  });

  assert.ok(buildHistoryEntries(r).every(
    event => event.rejectionReason === null
  ));

  for (const event of r.events) {
    assert.deepEqual(eventDetail(r, event),
      { kind: 'unavailable' });
  }
});

test('Explicit event types take precedence over legacy descriptions', () => {
  const r = legacyRejectionFixture();

  r.events[0].type = 'future-event';

  assert.equal(buildHistoryEntries(r)[0].rejectionReason, null);
  assert.equal(historyRows(r)[0].category, 'other');
  assert.deepEqual(eventDetail(r, r.events[0]),
    { kind: 'event' });
});
