import { useEffect, useMemo, useState } from 'react';
import type { ReviewData } from '../types/review';
import { collectActorIds, extractUserNames, userBulkPath } from './actor-names.mjs';

/** Resolve only display names, as the current Jira user, without writing names to KVS. */
export function useActorNames(review: ReviewData | null, enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = useMemo(() => collectActorIds(review), [review]);
  const identity = ids.join('|');

  useEffect(() => {
    if (!enabled || ids.length === 0) {
      setNames({});
      return;
    }
    let cancelled = false;
    setNames({});
    (async () => {
      try {
        const { requestJira } = await import('@forge/bridge');
        const resolved: Record<string, string> = {};
        for (let i = 0; i < ids.length; i += 25) {
          const batch = ids.slice(i, i + 25);
          const url = userBulkPath(batch);
          if (!url) continue;
          const response = await requestJira(url, { headers: { Accept: 'application/json' } });
          if (!response.ok) continue;
          const data: unknown = await response.json();
          Object.assign(resolved, extractUserNames(data, batch));
        }
        if (!cancelled) setNames(resolved);
      } catch {
        // A missing permission, hidden profile, or Jira API outage must never block reviews.
        if (!cancelled) setNames({});
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, identity]);

  return names;
}
