import ResolverModule from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { blankReview, applyCommand, summarize } from './domain.js';

// Forge's ESM bundler can expose the CommonJS resolver as a namespace object.
// Unwrap its default export before constructing it (Node/Forge interop).
const Resolver = ResolverModule.default ?? ResolverModule;
const resolver = new Resolver();
const validKey = (key) => /^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(key);
const reviewKey = (id) => `review:${id}`;
const indexKey = (projectId) => `project:${projectId}:issues`;

async function jiraIssue(issueKey) {
  const key = String(issueKey ?? '').trim().toUpperCase();
  if (!validKey(key)) throw new Error('INVALID_ISSUE_KEY');
  // Authorize every read and write against Jira using the ACTING USER.
  const response = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=summary,project`);
  if (!response.ok) throw new Error(response.status === 403 || response.status === 404 ? 'ISSUE_NOT_ACCESSIBLE' : `JIRA_ERROR_${response.status}`);
  const data = await response.json();
  return {id:String(data.id), key:data.key, summary:data.fields.summary,
    projectId:String(data.fields.project.id), projectKey:data.fields.project.key};
}

resolver.define('getReview', async ({payload}) => {
  const issue = await jiraIssue(payload.issueKey);
  const data = await kvs.get(reviewKey(issue.id)) ?? blankReview(issue);
  return {review:data, derived:summarize(data)};
});

resolver.define('command', async ({payload,context}) => {
  if (!context.accountId) throw new Error('AUTH_REQUIRED');
  const issue = await jiraIssue(payload.issueKey);
  const perms = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${issue.key}&permissions=EDIT_ISSUES`);
  if (!perms.ok || !(await perms.json()).permissions?.EDIT_ISSUES?.havePermission) throw new Error('EDIT_PERMISSION_REQUIRED');
  const original = await kvs.get(reviewKey(issue.id)) ?? blankReview(issue);
  const updated = applyCommand(original, payload.command, context.accountId);
  // MVP uses sequential optimistic revision checking; true atomic CAS is pending.
  await kvs.set(reviewKey(issue.id), updated);
  const index = await kvs.get(indexKey(issue.projectId)) ?? [];
  if (!index.includes(issue.key)) await kvs.set(indexKey(issue.projectId), [...index, issue.key].slice(0, 200));
  return {review:updated, derived:summarize(updated)};
});

resolver.define('listReviews', async ({payload}) => {
  const projectKey = String(payload.projectKey ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,30}$/.test(projectKey)) throw new Error('INVALID_PROJECT_KEY');
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}`);
  if (!res.ok) throw new Error('PROJECT_NOT_ACCESSIBLE');
  const project = await res.json();
  const index = await kvs.get(indexKey(String(project.id))) ?? [];
  const rows = [];
  for (const issueKey of index.slice(0, 40)) {
    try {
      const issue = await jiraIssue(issueKey);
      if (String(issue.projectId) !== String(project.id)) continue;
      const r = await kvs.get(reviewKey(issue.id));
      if (r) { const state = summarize(r); rows.push({issueKey:r.issueKey,summary:r.summary,
        status:state.status,covered:state.covered,mandatory:state.mandatory}); }
    } catch { /* no disclosure of inaccessible issues */ }
  }
  return rows;
});
export const handler = resolver.getDefinitions();
