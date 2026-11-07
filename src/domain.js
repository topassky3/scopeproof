// Shared, deterministic business rules. No Forge dependencies: independently testable.
export function blankReview(issue) {
  return { issueId: String(issue.id), issueKey: issue.key, summary: issue.summary,
    projectId: String(issue.projectId), projectKey: issue.projectKey,
    revision: 0, requirements: [], evidence: [], approvals: [], events: [] };
}
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

export function summarize(review) {
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
  const snapshotMatches = latestApproval?.type === 'approved' && latestApproval.snapshot.every(s => {
    const r = rows.find(r => r.id === s.requirementId);
    return r && r.version === s.version && r.latestEvidence?.id === s.evidenceId && r.state === 'satisfied';
  }) && latestApproval.snapshot.length === mandatory.length;
  let status = 'pending';
  if (latestApproval?.type === 'rejected') status = 'rejected';
  else if (latestApproval?.type === 'approved') status = snapshotMatches ? 'approved' : 'revalidation';
  else if (requirements.length) status = covered === mandatory.length ? 'ready' : 'in-review';
  return { rows, mandatory: mandatory.length, covered, status,
    blockers: rows.filter(r => r.mandatory && r.state !== 'satisfied'), latestApproval };
}

export function applyCommand(current, command, actor = 'unknown') {
  if (!current || !command || typeof command !== 'object') throw new Error('INVALID_REQUEST');
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision !== current.revision) {
    throw new Error('CONFLICT: Review was updated. Reload before saving.');
  }
  const review = structuredClone(current);
  const date = now();
  const event = (type, description) => review.events.push({ id: uid(), type, description, actor, createdAt: date });
  if (command.type === 'addRequirement') {
    const title = clean(command.title, 180);
    if (title.length < 5) throw new Error('A requirement title needs at least 5 characters.');
    const id = `RQ-${String(review.requirements.length + 1).padStart(2, '0')}`;
    review.requirements.push({ id, title, mandatory: command.mandatory !== false, version: 1,
      versions: [{version: 1, title, actor, createdAt: date}] });
    event('requirement-created', `${id} v1 created`);
  } else if (command.type === 'publishVersion') {
    const r = review.requirements.find(r => r.id === command.requirementId);
    if (!r) throw new Error('Requirement not found.');
    const title = clean(command.title, 180);
    if (title.length < 5 || title === r.title) throw new Error('Enter a changed requirement title.');
    const wasApproved = summarize(review).status === 'approved';
    r.version += 1;
    r.title = title;
    r.versions.push({version: r.version, title, actor, createdAt: date});
    event('requirement-updated', `${r.id} updated to v${r.version}; evidence must be reviewed`);
    if (wasApproved) event('approval-revalidation', `Prior approval requires revalidation because ${r.id} changed`);
  } else if (command.type === 'addEvidence') {
    const r = review.requirements.find(r => r.id === command.requirementId);
    if (!r) throw new Error('Requirement not found.');
    if (!['passed', 'failed'].includes(command.result)) throw new Error('Choose Passed or Failed.');
    const title = clean(command.title, 180);
    if (title.length < 3) throw new Error('Provide a short evidence title.');
    const url = clean(command.url, 500);
    if (url && !/^https:\/\//i.test(url)) throw new Error('Evidence URL must use HTTPS.');
    const id = `EV-${String(review.evidence.length + 101)}`;
    review.evidence.push({ id, requirementId: r.id, version: r.version, title, url,
      result: command.result, actor, createdAt: date });
    event('evidence-added', `${id} ${command.result} for ${r.id} v${r.version}`);
  } else if (command.type === 'approve') {
    const state = summarize(review);
    if (!state.mandatory || state.blockers.length) throw new Error('APPROVAL_BLOCKED: All mandatory requirements need current passing evidence.');
    const snapshot = state.rows.filter(r => r.mandatory).map(r => ({requirementId:r.id, version:r.version, evidenceId:r.latestEvidence.id}));
    review.approvals.push({id:uid(), type:'approved', actor, createdAt:date, note:clean(command.note, 500), snapshot});
    event('review-approved', `Review approved with ${snapshot.length} mandatory requirements`);
  } else if (command.type === 'reject') {
    const note = clean(command.note, 500);
    if (note.length < 5) throw new Error('A rejection reason is required.');
    review.approvals.push({id:uid(), type:'rejected', actor, createdAt:date, note, snapshot:[]});
    event('review-rejected', 'Review rejected');
  } else { throw new Error('Unknown command.'); }
  review.revision++;
  return review;
}

export function exampleReview() {
  let review = blankReview({id:'142',key:'ACO-142',summary:'Implement SSO authentication',projectId:'1',projectKey:'ACO'});
  const add = (type, props) => { review = applyCommand(review, {type, expectedRevision:review.revision,...props}, 'demo'); };
  add('addRequirement',{title:'Users can sign in using SSO'});
  add('addRequirement',{title:'Sessions expire after 30 minutes'});
  add('addRequirement',{title:'All sign-in attempts are audited'});
  add('addEvidence',{requirementId:'RQ-01',title:'SSO login test',result:'passed',url:'https://example.com/demo/EV-101'});
  add('addEvidence',{requirementId:'RQ-02',title:'Session expiration test',result:'passed'});
  add('addEvidence',{requirementId:'RQ-03',title:'Sign-in audit test',result:'passed'});
  add('approve',{note:'All checks passed for v1'});
  add('publishVersion',{requirementId:'RQ-01',title:'SSO requires mandatory MFA'});
  return review;
}
