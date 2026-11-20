import type { ReviewData, EvidenceRecord } from '../../shared/types/review';

export interface EvidenceViewRow extends EvidenceRecord {
  actor?: string;
  createdAt?: string;
  requirementTitle: string;
  currentRequirementTitle: string | null;
  mandatory: boolean;
  currentVersion: number | null;
  applicability: 'current' | 'outdated' | 'superseded' | 'unknown';
}

export function buildEvidenceRows(review: ReviewData): EvidenceViewRow[];
export function evidenceMetrics(rows: EvidenceViewRow[]): {
  total: number;
  current: number;
  outdated: number;
  failedCurrent: number;
};
export function filterEvidenceRows(
  rows: EvidenceViewRow[],
  query?: string,
  applicability?: string,
  result?: string
): EvidenceViewRow[];
