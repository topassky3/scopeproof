import type { ReviewData, ReviewSummary } from '../../shared/types/review';
export function downloadReportPdf(review: ReviewData, summary: ReviewSummary): Promise<void>;
