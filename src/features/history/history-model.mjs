import { actorLabel } from '../../shared/actors/actor-names.mjs';
const array = value => Array.isArray(value) ? value : [];
const labels = {
  'requirement-created':'Requirement created', 'requirement-updated':'Requirement updated',
  'evidence-added':'Evidence recorded', 'review-approved':'Review approved',
  'review-rejected':'Review rejected', 'approval-revalidation':'Revalidation required',
};
const groups = {
  'requirement-created':'requirements','requirement-updated':'requirements',
  'evidence-added':'evidence','review-approved':'decisions','review-rejected':'decisions',
  'approval-revalidation':'revalidation',
};
const unique = records => records.length === 1 ? records[0] : null;
const sameRecord = (event, record) => Boolean(event.actor && event.createdAt &&
  event.actor === record.actor && event.createdAt === record.createdAt);
const text = value => typeof value === 'string' ? value : '';
export function historyRows(review) {
  // The stored event sequence is authoritative, including equal timestamps.
  return array(review?.events).slice().reverse().map((event,index) => ({
    event, key: String(event.id ?? 'event') + ':' + (review.events.length - 1 - index),
    category: groups[event.type] ?? 'other', label: labels[event.type] ?? 'Other event',
  }));
}
export function historyMetrics(rows) {
  return {total: rows.length, requirements: rows.filter(r=>r.category==='requirements').length,
    evidence:rows.filter(r=>r.category==='evidence').length,
    decisions:rows.filter(r=>r.category==='decisions').length,
    revalidation:rows.filter(r=>r.category==='revalidation').length};
}
export function filterHistory(rows, query='', category='all', actorNames={}) {
  const needle=query.trim().toLowerCase();
  return rows.filter(({event,label,category:group}) =>
    (category==='all'||category===group) &&
    [event.description,label,actorLabel(event.actor, actorNames)].some(v=>text(v).toLowerCase().includes(needle)));
}
export function eventDetail(review,event) {
  const description=text(event.description);
  if(event.type==='review-approved'||event.type==='review-rejected') {
    const type=event.type==='review-approved'?'approved':'rejected';
    const matches=array(review.approvals).filter(a=>a?.type===type&&sameRecord(event,a));
    // Older records have no explicit event-to-decision ID. Never guess if ambiguous.
    const decision=unique(matches);
    return decision ? {kind:'decision',note:text(decision.note),snapshot:array(decision.snapshot).map(s=>({
      requirementId:text(s?.requirementId),version:s?.version,evidenceId:text(s?.evidenceId)
    }))} : {kind:'unavailable'};
  }
  if(event.type==='requirement-created'||event.type==='requirement-updated') {
    const match=description.match(event.type==='requirement-created'
      ? /^(RQ-\d+) v(\d+) created$/ : /^(RQ-\d+) updated to v(\d+); evidence must be reviewed$/);
    if(!match) return {kind:'unavailable'};
    const req=unique(array(review.requirements).filter(r=>r.id===match[1]));
    const version=Number(match[2]);
    const versions=array(req?.versions);
    const record=unique(versions.filter(v=>v.version===version&&sameRecord(event,v)));
    if(!record || !text(record.title)) return {kind:'unavailable'};
    const previous=unique(versions.filter(v=>v.version===version-1));
    return {kind:'requirement',requirementId:req.id,version,title:record.title,
      previousTitle:text(previous?.title)||null};
  }
  if(event.type==='evidence-added') {
    const match=description.match(/^(EV-\d+) (passed|failed) for (RQ-\d+) v(\d+)$/);
    if(!match) return {kind:'unavailable'};
    const record=unique(array(review.evidence).filter(e=>e.id===match[1]&&e.result===match[2]
      &&e.requirementId===match[3]&&e.version===Number(match[4])&&sameRecord(event,e)));
    return record ? {kind:'evidence',evidenceId:record.id,requirementId:record.requirementId,
      version:record.version,result:record.result,title:text(record.title)} : {kind:'unavailable'};
  }
  return {kind:'event'};
}
