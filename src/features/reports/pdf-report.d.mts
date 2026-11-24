import type { ReviewData, ReviewSummary } from '../../shared/types/review';
import type { buildReportDiagnostic } from './report-intelligence.js';
export function downloadReportPdf(review: ReviewData, summary: ReviewSummary, reportDiagnostic: ReturnType<typeof buildReportDiagnostic>): Promise<void>;
