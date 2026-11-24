/** Session-only UI preference; never stores review contents or grants access. */
const projectPattern = /^[A-Z][A-Z0-9_]{0,30}$/;
const part = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value;
const issuePattern = /^[A-Z][A-Z0-9_]{0,30}-[1-9][0-9]{0,8}$/;
const validIssue = (scope,key) => !!scope && typeof key === 'string' && issuePattern.test(key) && key.startsWith(scope.projectKey + '-');

export function selectionScope(context) {
  const project = context?.extension?.project;
  if (context?.moduleKey !== 'scopeproof-project' || context?.extension?.issue?.key) return null;
  if (![context?.cloudId,context?.accountId,context?.environmentId,project?.id].every(part)
    || !projectPattern.test(project?.key ?? '')) return null;
  return {
    projectId:project.id, projectKey:project.key,
    key:'scopeproof:selected-review:v1:' + JSON.stringify([context.cloudId,context.accountId,context.environmentId,project.id,project.key]),
  };
}
export function matchesProject(scope,review) {
  return !!scope && String(review?.projectId ?? '') === scope.projectId
    && review?.projectKey === scope.projectKey && validIssue(scope,review?.issueKey);
}
export function readSelection(scope,storage) {
  if(!scope) return null;
  try {
    const key=storage().getItem(scope.key);
    return validIssue(scope,key) ? key : null;
  } catch { return null; }
}
export function rememberSelection(scope,review,storage) {
  if(!matchesProject(scope,review)) return false;
  try { storage().setItem(scope.key,review.issueKey);return true; } catch { return false; }
}
export function forgetSelection(scope,storage) {
  if(!scope) return;
  try { storage().removeItem(scope.key); } catch { /* best effort */ }
}
