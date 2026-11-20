/** Pure actor projection: stable ids remain authoritative in persisted audit records. */
const validId = id => typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9:_-]+$/.test(id)
  && (id.includes(':') || /^[a-fA-F0-9]{20,}$/.test(id));

export function collectActorIds(review) {
  const items = [
    ...(review?.events ?? []).map(entry => entry.actor),
    ...(review?.evidence ?? []).map(entry => entry.actor),
    ...(review?.approvals ?? []).map(entry => entry.actor),
    ...(review?.requirements ?? []).flatMap(req => (req.versions ?? []).map(v => v.actor)),
  ];
  return [...new Set(items.filter(validId))].slice(0, 100);
}

export function userBulkPath(ids) {
  const valid = [...new Set(ids.filter(validId))].slice(0, 25);
  if (!valid.length) return null;
  return '/rest/api/3/user/bulk?maxResults=25&' +
    valid.map(id => 'accountId=' + encodeURIComponent(id)).join('&');
}

export function extractUserNames(result, requestedIds) {
  const allowed = new Set(requestedIds);
  const names = {};
  for (const entry of Array.isArray(result?.values) ? result.values : []) {
    if (!allowed.has(entry?.accountId) || typeof entry.displayName !== 'string') continue;
    const name = entry.displayName.trim().slice(0, 100);
    if (name) names[entry.accountId] = name;
  }
  return names;
}

export function actorLabel(actor, names = {}) {
  if (!actor) return 'Not recorded';
  const name = names[actor];
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (actor === 'demo' || actor === 'local-preview') return 'Demo user';
  if (!validId(actor)) return 'Unresolved actor';
  return 'Jira user · ' + actor.slice(-6);
}
