import ResolverModule from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs, Filter, FilterConditions } from '@forge/kvs';
import { createCesAdapter } from './ces-adapter.js';
import { createReviewStore } from './review-store.js';

// Forge's ESM bundler can expose the CommonJS resolver as a namespace object.
// Unwrap its default export before constructing it (Node/Forge interop).
const Resolver = ResolverModule.default ?? ResolverModule;
const resolver = new Resolver();
const validKey = (key) => /^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(key);
const store = createReviewStore(createCesAdapter({kvs, Filter, FilterConditions}));

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
  return store.getReview(issue);
});

resolver.define('command', async ({payload,context}) => {
  if (!context.accountId) throw new Error('AUTH_REQUIRED');
  const issue = await jiraIssue(payload.issueKey);
  const perms = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${issue.key}&permissions=EDIT_ISSUES`);
  if (!perms.ok || !(await perms.json()).permissions?.EDIT_ISSUES?.havePermission) throw new Error('EDIT_PERMISSION_REQUIRED');
  return store.command(issue, payload.command, context.accountId);
});

resolver.define('listReviews', async ({payload}) => {
  const projectKey = String(payload.projectKey ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,30}$/.test(projectKey)) throw new Error('INVALID_PROJECT_KEY');
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}`);
  if (!res.ok) throw new Error('PROJECT_NOT_ACCESSIBLE');
  const project = await res.json();
  const index = await store.candidateKeys(String(project.id));
  const rows = [];
  for (const issueKey of index.slice(0, 40)) {
    try {
      const issue = await jiraIssue(issueKey);
      if (String(issue.projectId) !== String(project.id)) continue;
      const row = await store.row(issue);
      if (row) rows.push(row);
    } catch (error) {
      if (error?.message !== 'ISSUE_NOT_ACCESSIBLE') throw error;
      // Do not disclose inaccessible issues or silently hide storage failures.
    }
  }
  return rows;
});
export const handler = resolver.getDefinitions();
