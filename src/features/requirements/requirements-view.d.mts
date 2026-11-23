import type { RequirementRow, ReviewSummary, EvidenceRecord } from '../../shared/types/review';
export interface EvidenceOverview {
  label: string;
  current: EvidenceRecord | null;
  previousCount: number;
  description: string;
}
export interface RequirementMetrics {
  total: number;
  mandatory: number;
  optional: number;
  covered: number;
  attention: number;
}
export function evidenceOverview(row: RequirementRow, evidence?: EvidenceRecord[]): EvidenceOverview;
export function requirementMetrics(summary: ReviewSummary): RequirementMetrics;
export function findRequirements(rows: RequirementRow[], search?: string, state?: string): RequirementRow[];
