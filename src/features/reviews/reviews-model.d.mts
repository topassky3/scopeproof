import type { ReviewData, ReviewSummary } from '../../shared/types/review';
export interface ReviewDecision {
  type: 'approved' | 'rejected';
  actor: string;
  createdAt: string;
  note: string;
  snapshotCount: number;
}
export function latestReviewDecision(review: ReviewData): ReviewDecision | null;
export function reviewActionMessage(summary: ReviewSummary): string;
