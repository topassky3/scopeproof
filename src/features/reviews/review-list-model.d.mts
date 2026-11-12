import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

export function buildReviewRows(
  selected: ReviewData | null, summary: ReviewSummary | null, indexed?: ReviewListItem[],
): ReviewListItem[];
export function filterReviewRows(
  rows: ReviewListItem[], search?: string, status?: string,
): ReviewListItem[];
export function reviewMetrics(rows: ReviewListItem[]): {
  reviews: number;
  approved: number;
  revalidation: number;
  notFinalized: number;
};
