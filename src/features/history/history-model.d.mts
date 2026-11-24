import type { AuditEvent, ReviewData } from '../../shared/types/review';
export type HistoryRow={event:AuditEvent;key:string;category:string;label:string};
export type EventDetail=
 | {kind:'decision';note:string;snapshot:{requirementId:string;version:number;evidenceId:string}[]}
 | {kind:'requirement';requirementId:string;version:number;title:string;previousTitle:string|null}
 | {kind:'evidence';evidenceId:string;requirementId:string;version:number;result:string;title:string}
 | {kind:'unavailable'|'event'};
export function historyRows(review:ReviewData):HistoryRow[];
export function historyMetrics(rows:HistoryRow[]):{total:number;requirements:number;evidence:number;decisions:number;revalidation:number};
export function filterHistory(rows:HistoryRow[],query?:string,category?:string,actorNames?:Record<string,string>):HistoryRow[];
export function eventDetail(review:ReviewData,event:AuditEvent):EventDetail;

/** Backward-compatible contract for LocalReviews. */
export interface DisplayHistoryEntry extends AuditEvent {
  type?: string;
  rejectionReason: string | null;
}

export function buildHistoryEntries(
  review: ReviewData
): DisplayHistoryEntry[];
