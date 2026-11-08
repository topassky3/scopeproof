import { ReviewWorkspace } from '../reviews/ReviewWorkspace';
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'History') => void;
  onSelectIssue: (key: string) => void;
}

/** Dedicated feature entrypoint; the detailed dashboard will replace the shared workspace in phase 2. */
export function OverviewPage(props: Props) { return <ReviewWorkspace {...props}/>; }
