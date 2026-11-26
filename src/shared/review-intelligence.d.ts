/** Read-only projection of a single Forge review revision. */
export type ReviewStatus = 'pending' | 'in-review' | 'ready' | 'approved' | 'revalidation' | 'rejected';
export type EvidenceState = 'satisfied' | 'failed' | 'stale' | 'missing';
export type SnapshotRelation = 'unavailable' | 'not-applicable' | 'not-captured' | 'version-changed' | 'evidence-changed' | 'matching';
export type ImpactReason = 'NO_MANDATORY_REQUIREMENTS' | 'MANDATORY_IDS_AMBIGUOUS' |
  'SNAPSHOT_INVALID' | 'SNAPSHOT_SCOPE_MISMATCH' | 'MANDATORY_SCOPE_NOT_IN_SNAPSHOT' |
  'REQUIREMENT_VERSION_CHANGED' | 'EVIDENCE_SUPERSEDED' | 'SNAPSHOT_EVIDENCE_UNVERIFIED' |
  'EVIDENCE_MISSING' | 'EVIDENCE_FAILED' | 'FRESH_APPROVAL_REQUIRED';
export type PlanningIssue = 'INVALID_REVIEW_STRUCTURE' | 'INVALID_REQUIREMENT' |
  'AMBIGUOUS_REQUIREMENT_ID' | 'INVALID_EVIDENCE' | 'AMBIGUOUS_EVIDENCE_ID' |
  'INVALID_EVIDENCE_REFERENCE' | 'INVALID_LATEST_DECISION' | 'SNAPSHOT_INVALID' |
  'SNAPSHOT_SCOPE_OR_VERSION_INCONSISTENT' | 'SNAPSHOT_EVIDENCE_UNVERIFIED' |
  'EVIDENCE_ID_ALLOCATION_COLLISION';
export interface RequirementImpact {
  requirementId: string;
  version: number;
  evidenceId: string | null;
  state: EvidenceState;
  snapshotRelation: SnapshotRelation;
  previousVersion: number | null;
  previousEvidenceId: string | null;
  reasons: ImpactReason[];
}
export interface ReviewImpact {
  status: ReviewStatus;
  activeRevalidation: boolean;
  mandatory: number;
  covered: number;
  coveragePercent: number | null;
  optionalCount: number;
  reviewReasons: ImpactReason[];
  requirements: RequirementImpact[];
}
export type PlannedAction =
  | { type: 'obtain-passing-evidence'; requirementId: string; version: number; reasons: ImpactReason[] }
  | { type: 'request-explicit-approval' };
export interface RetainedEvidence {
  requirementId: string;
  version: number;
  evidenceId: string;
  snapshotRelation: SnapshotRelation;
}
interface PlanBase {
  revision: number | null;
  status: ReviewStatus | null;
  minimumActions: number | null;
  actions: PlannedAction[];
  retainedEvidence: RetainedEvidence[];
  issues: PlanningIssue[];
}
export interface InspectionPlan extends PlanBase {
  disposition: 'inspect-records';
  minimumActions: null;
}
export interface AvailablePlan extends PlanBase {
  disposition: 'no-action' | 'revalidate' | 'initial-approval' | 'human-review' | 'define-mandatory-scope';
  revision: number;
  status: ReviewStatus;
}
export type ReviewIntelligence =
  | { kind: 'unavailable'; revision: number | null; impact: null; plan: InspectionPlan }
  | { kind: 'available'; revision: number; impact: ReviewImpact; plan: AvailablePlan };
/** A caller must branch on kind before presenting the diagnostic as available. */
export function buildReviewIntelligence(review: unknown): ReviewIntelligence;
/** Verify an unchanged projection against its exact original data record. */
export function matchesReviewSource(intelligence: unknown, review: unknown): boolean;
