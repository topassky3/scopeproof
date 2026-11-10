/**
 * Pure projection helpers for the Reviews frontend.
 * Forge/domain.js is authoritative for writes; never treat these client checks as authorization.
 */
export function deriveReview(review) {
  const requirements = review?.requirements ?? [];
  const evidence = review?.evidence ?? [];
  const mandatory = requirements.filter(item => item.mandatory);
  const rows = requirements.map(item => {
    const latestEvidence = evidence.filter(record =>
      record.requirementId === item.id && record.version === item.version
    ).at(-1) ?? null;
    const hasOldEvidence = evidence.some(record =>
      record.requirementId === item.id && record.version < item.version
    );
    const state = latestEvidence
      ? (latestEvidence.result === 'passed' ? 'satisfied' : 'failed')
      : (hasOldEvidence ? 'stale' : 'missing');
    return { ...item, latestEvidence, state };
  });
  const covered = rows.filter(item => item.mandatory && item.state === 'satisfied').length;
  const blockers = rows.filter(item => item.mandatory && item.state !== 'satisfied');
  const latestApproval = (review?.approvals ?? []).at(-1) ?? null;
  const snapshot = latestApproval?.snapshot ?? [];
  const snapshotMatches = latestApproval?.type === 'approved'
    && snapshot.length === mandatory.length
    && snapshot.every(saved => {
      const current = rows.find(item => item.id === saved.requirementId);
      return current && current.version === saved.version
        && current.latestEvidence?.id === saved.evidenceId
        && current.state === 'satisfied';
    });
  let status = 'pending';
  if (latestApproval?.type === 'rejected') status = 'rejected';
  else if (latestApproval?.type === 'approved') status = snapshotMatches ? 'approved' : 'revalidation';
  else if (requirements.length) status = covered === mandatory.length ? 'ready' : 'in-review';
  return { rows, mandatory: mandatory.length, covered, blockers, status, latestApproval };
}

export function canApprove(summary) {
  return Boolean(summary && summary.mandatory > 0 && summary.blockers.length === 0);
}

export function buildReviewList(selected, summary, indexed = []) {
  const byKey = new Map(indexed.map(item => [item.issueKey, item]));
  if (selected && summary) byKey.set(selected.issueKey, {
    issueKey: selected.issueKey,
    summary: selected.summary,
    status: summary.status,
    covered: summary.covered,
    mandatory: summary.mandatory,
  });
  return [...byKey.values()].sort((a, b) => a.issueKey.localeCompare(b.issueKey));
}

export function filterReviewList(rows, search = '', status = 'all') {
  const term = search.trim().toLowerCase();
  return rows.filter(item =>
    (status === 'all' || item.status === status)
    && (!term || item.issueKey.toLowerCase().includes(term)
      || item.summary.toLowerCase().includes(term))
  );
}

export function reviewMetrics(rows) {
  return {
    reviews: rows.length,
    approved: rows.filter(item => item.status === 'approved').length,
    revalidation: rows.filter(item => item.status === 'revalidation').length,
    notFinalized: rows.filter(item => ['pending', 'ready', 'in-review'].includes(item.status)).length,
  };
}

export function makeDemoReview() {
  return {
    issueKey: 'ACO-142',
    projectKey: 'ACO',
    summary: 'Implement SSO authentication',
    revision: 8,
    requirements: [
      { id: 'RQ-01', title: 'SSO requires mandatory MFA', version: 2, mandatory: true },
      { id: 'RQ-02', title: 'Sessions expire after 30 minutes', version: 1, mandatory: true },
      { id: 'RQ-03', title: 'All sign-in attempts are audited', version: 1, mandatory: true },
    ],
    evidence: [
      { id: 'EV-101', requirementId: 'RQ-01', version: 1, title: 'SSO sign-in passed in v1', result: 'passed' },
      { id: 'EV-102', requirementId: 'RQ-02', version: 1, title: 'Expiration test', result: 'passed' },
      { id: 'EV-103', requirementId: 'RQ-03', version: 1, title: 'Audit events test', result: 'passed' },
    ],
    approvals: [{
      id: 'AP-1', type: 'approved', actor: 'demo-reviewer',
      createdAt: '2026-11-09T12:00:00Z',
      note: 'All v1 checks passed',
      snapshot: [
        { requirementId: 'RQ-01', version: 1, evidenceId: 'EV-101' },
        { requirementId: 'RQ-02', version: 1, evidenceId: 'EV-102' },
        { requirementId: 'RQ-03', version: 1, evidenceId: 'EV-103' },
      ],
    }],
    events: [
      { id: 'H-1', description: 'Review approved with v1 evidence', actor: 'demo-reviewer', createdAt: '2026-11-09T12:00:00Z' },
      { id: 'H-2', description: 'RQ-01 updated to v2; prior approval requires revalidation', actor: 'demo-editor', createdAt: '2026-11-09T13:00:00Z' },
    ],
  };
}

/** Preview-only transitions. Never used for real Jira mutations. */
export function applyPreviewCommand(current, command) {
  if (command.expectedRevision !== current.revision) {
    throw new Error('CONFLICT: Review changed. Reload before saving.');
  }
  const next = structuredClone(current);
  const date = new Date().toISOString();
  const actor = 'local-preview';
  if (command.type === 'addEvidence') {
    const req = next.requirements.find(item => item.id === command.requirementId);
    if (!req) throw new Error('Requirement not found.');
    if (!['passed', 'failed'].includes(command.result)) throw new Error('Choose a valid test result.');
    const title = String(command.title ?? '').trim();
    if (title.length < 3) throw new Error('Provide a test title.');
    next.evidence.push({
      id: 'EV-' + (101 + next.evidence.length),
      requirementId: req.id, version: req.version, title, result: command.result,
    });
    next.events.push({ id: 'H-' + (next.events.length + 1), actor, createdAt: date,
      description: 'New ' + command.result + ' evidence for ' + req.id + ' v' + req.version });
  } else if (command.type === 'approve') {
    const summary = deriveReview(next);
    if (!canApprove(summary)) throw new Error('APPROVAL_BLOCKED: Current passing evidence required.');
    const snapshot = summary.rows.filter(row => row.mandatory).map(row => ({
      requirementId: row.id, version: row.version, evidenceId: row.latestEvidence.id,
    }));
    next.approvals.push({ id: 'AP-' + (next.approvals.length + 1), type: 'approved', actor,
      createdAt: date, snapshot, note: '' });
    next.events.push({ id: 'H-' + (next.events.length + 1), actor, createdAt: date,
      description: 'Review approved with ' + snapshot.length + ' mandatory requirements' });
  } else if (command.type === 'reject') {
    const note = String(command.note ?? '').trim();
    if (note.length < 5) throw new Error('A rejection reason of at least 5 characters is required.');
    next.approvals.push({ id: 'AP-' + (next.approvals.length + 1), type: 'rejected', actor,
      createdAt: date, snapshot: [], note });
    next.events.push({ id: 'H-' + (next.events.length + 1), actor, createdAt: date,
      description: 'Review rejected with reason' });
  } else {
    throw new Error('Unsupported preview command.');
  }
  next.revision += 1;
  return next;
}
