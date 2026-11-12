import type { ReviewData } from '../../shared/types/review';

export interface DisplayHistoryEntry {
  id: string;
  description: string;
  actor: string;
  createdAt: string;
  type?: string;
  rejectionReason: string | null;
}
export function buildHistoryEntries(review: ReviewData): DisplayHistoryEntry[];
