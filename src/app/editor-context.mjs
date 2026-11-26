// Bind the editor to the exact issue, revision and requirement selected.
export function captureEditorContext(review, mode, id = '') {
  if (!review || typeof review.issueId !== 'string' || typeof review.issueKey !== 'string' ||
      typeof review.projectId !== 'string' || !Number.isSafeInteger(review.revision) ||
      !Array.isArray(review.requirements) || !['requirement','version','evidence','reject'].includes(mode)) return null;
  const targeted = mode === 'evidence' || mode === 'version';
  const matches = targeted ? review.requirements.filter(r => r.id === id) : [];
  if (targeted && (matches.length !== 1 || !Number.isSafeInteger(matches[0].version) || typeof matches[0].title !== 'string')) return null;
  return {issueId:review.issueId, issueKey:review.issueKey, projectId:review.projectId,
    revision:review.revision, mode, target:targeted ? {id:matches[0].id,version:matches[0].version,title:matches[0].title} : null};
}
export function editorContextMatches(review, context) {
  if (!context) return false;
  const now = captureEditorContext(review, context.mode, context.target?.id ?? '');
  return Boolean(now && now.issueId === context.issueId && now.issueKey === context.issueKey &&
    now.projectId === context.projectId && now.revision === context.revision &&
    now.mode === context.mode && now.target?.id === context.target?.id &&
    now.target?.version === context.target?.version && now.target?.title === context.target?.title);
}
