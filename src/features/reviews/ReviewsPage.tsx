import { ReviewWorkspace } from './ReviewWorkspace';
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'Evidence' | 'History') => void;
  onSelectIssue: (key: string) => void;
  onNewReview: () => void;
  actorNames?: Record<string, string>;
}

export function ReviewsPage(props: Props) { return <ReviewWorkspace {...props} />; }
