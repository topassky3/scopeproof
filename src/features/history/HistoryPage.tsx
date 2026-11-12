import { Panel } from '../../shared/components/ui';
import type { ReviewData } from '../../shared/types/review';
import { buildHistoryEntries } from './history-model.mjs';

const formatDate = (value: string) => value ? new Date(value).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '';

export function HistoryPage({ review }: { review: ReviewData }) {
  const entries = buildHistoryEntries(review);
  return <Panel title="Timeline" aside={<span>{review.events.length} events</span>}>
    <div className="timeline">{entries.map(event => <div key={event.id} className="event">
      <span className="event-dot"/>
      <div>
        <b>{event.description}</b>
        {event.rejectionReason && <p>Reason: {event.rejectionReason}</p>}
        <small>{event.actor} · {formatDate(event.createdAt)}</small>
      </div>
    </div>)}</div>
  </Panel>;
}
