import { Panel } from '../../shared/components/ui';
import type { ReviewData } from '../../shared/types/review';
import { actorLabel } from '../../shared/actors/actor-names.mjs';

const formatDate = (value: string) => value ? new Date(value).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '';

export function HistoryPage({ review, actorNames = {} }: { review: ReviewData; actorNames?: Record<string, string> }) {
  return <Panel title="Timeline" aside={<span>{review.events.length} events</span>}>
    <div className="timeline">{[...review.events].reverse().map(event => <div key={event.id} className="event">
      <span className="event-dot"/>
      <div><b>{event.description}</b><small title={event.actor}>{actorLabel(event.actor, actorNames)} · {formatDate(event.createdAt)}</small></div>
    </div>)}</div>
  </Panel>;
}
