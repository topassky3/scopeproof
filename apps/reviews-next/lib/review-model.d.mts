import type { ReviewData, ReviewListItem, ReviewSummary } from './types';
export function deriveReview(review: ReviewData): ReviewSummary;
export function canApprove(summary: ReviewSummary | null): boolean;
export function approvalAvailable(summary: ReviewSummary | null): boolean;
export function buildHistoryEntries(review: ReviewData): (ReviewData['events'][number] & { rejectionReason: string | null })[];
export function buildReviewList(selected: ReviewData | null, summary: ReviewSummary | null, indexed?: ReviewListItem[]): ReviewListItem[];
export function filterReviewList(rows: ReviewListItem[], search?: string, status?: string): ReviewListItem[];
export function reviewMetrics(rows: ReviewListItem[]): { reviews: number; approved: number; revalidation: number; notFinalized: number };
export function makeDemoReview(): ReviewData;
export function applyPreviewCommand(
  current: ReviewData,
  command: { type: string; expectedRevision: number; [key: string]: unknown }
): ReviewData;
