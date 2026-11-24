import type { ReviewData, ReviewSummary } from '../../shared/types/review';
import type { EvidenceViewRow } from '../evidence/evidence-model.mjs';
import type { HistoryRow, EventDetail } from '../history/history-model.mjs';

export function buildReport(review: ReviewData, summary: ReviewSummary): {
  coveragePercent: number | null;
  evidence: EvidenceViewRow[];
  evidenceCounts: { total: number; current: number; outdated: number; failedCurrent: number };
  historyCounts: { total: number; requirements: number; evidence: number; decisions: number; revalidation: number };
  decisions: (HistoryRow & { detail: EventDetail })[];
  activeRevalidation: boolean;
};
