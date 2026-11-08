/** Frontend view contracts. The authoritative rules remain in src/domain.js. */
export type EditorMode = 'requirement' | 'version' | 'evidence' | 'reject';

export interface RequirementRow {
  id: string;
  title: string;
  version: number;
  mandatory: boolean;
  state: string;
  latestEvidence?: { id: string } | null;
}
export interface ReviewSummary {
  rows: RequirementRow[];
  mandatory: number;
  covered: number;
  status: string;
  blockers: RequirementRow[];
}
export interface EvidenceRecord {
  id: string;
  requirementId: string;
  version: number;
  title: string;
  result: 'passed' | 'failed';
  url?: string;
}
export interface AuditEvent {
  id: string;
  description: string;
  actor: string;
  createdAt: string;
}
export interface ReviewData {
  issueKey: string;
  summary: string;
  revision: number;
  requirements: RequirementRow[];
  evidence: EvidenceRecord[];
  events: AuditEvent[];
  approvals: unknown[];
}
export interface ReviewListItem {
  issueKey: string;
  summary: string;
  status: string;
  covered: number;
  mandatory: number;
}
export type OpenEditor = (mode: EditorMode, target?: string) => void;
