import { ReviewWorkspace } from './ReviewWorkspace';
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'History') => void;
  onSelectIssue: (key: string) => void;
}

export function ReviewsPage(props: Props) { return <ReviewWorkspace {...props}/>; }
