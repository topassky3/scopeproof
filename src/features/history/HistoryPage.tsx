import { Panel } from '../../shared/components/ui';
import type { ReviewData } from '../../shared/types/review';

const formatDate = (value: string) => value ? new Date(value).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '';

export function HistoryPage({ review }: { review: ReviewData }) {
  return <Panel title="Timeline" aside={<span>{review.events.length} events</span>}>
    <div className="timeline">{[...review.events].reverse().map(event => <div key={event.id} className="event">
      <span className="event-dot"/>
      <div><b>{event.description}</b><small>{event.actor} · {formatDate(event.createdAt)}</small></div>
    </div>)}</div>
  </Panel>;
}
