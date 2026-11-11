export type RequirementState = 'satisfied' | 'stale' | 'missing' | 'failed';
export type ReviewState = 'approved' | 'revalidation' | 'ready' | 'in-review' | 'pending' | 'rejected';
export interface Requirement {
  id: string;
  title: string;
  version: number;
  mandatory: boolean;
}
export interface Evidence {
  id: string;
  requirementId: string;
  version: number;
  result: 'passed' | 'failed';
  title: string;
}
export interface Approval {
  id: string;
  type: 'approved' | 'rejected';
  actor: string;
  createdAt: string;
  note?: string;
  snapshot: { requirementId: string; version: number; evidenceId: string }[];
}
export interface HistoryEvent {
  id: string;
  description: string;
  actor: string;
  createdAt: string;
}
export interface ReviewData {
  issueKey: string;
  projectKey?: string;
  summary: string;
  revision: number;
  requirements: Requirement[];
  evidence: Evidence[];
  approvals: Approval[];
  events: HistoryEvent[];
}
export interface RequirementView extends Requirement {
  state: RequirementState;
  latestEvidence: Evidence | null;
}
export interface ReviewSummary {
  status: ReviewState;
  mandatory: number;
  covered: number;
  rows: RequirementView[];
  blockers: RequirementView[];
  latestApproval: Approval | null;
}
export interface ReviewListItem {
  issueKey: string;
  summary: string;
  status: ReviewState;
  covered: number;
  mandatory: number;
}
export interface ReviewResponse {
  review: ReviewData;
  derived: ReviewSummary;
}
