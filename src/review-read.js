// Boundary for Forge reads and the shared App preview. Raw summarize is a
// low-level projection, not an integrity or authorization check.
import { summarize } from './domain.js';
import { inspectReviewRecords } from './review-integrity.js';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const optionalText = value => value == null || typeof value === 'string';
const metadata = record => optionalText(record.actor) && optionalText(record.createdAt);

// Legacy absence of optional audit metadata or historical versions is not
// repaired here. Reject values that cannot safely be displayed as text.
export function readReviewForUse(review, issue = undefined) {
  try {
    const issues = inspectReviewRecords(review);
    if (issues.length) return { ok: false, issues, summary: null };
    if (!['issueId','issueKey','projectId','projectKey'].every(key => nonempty(review[key])) ||
        typeof review.summary !== 'string') {
      return { ok: false, issues: ['INVALID_REVIEW_IDENTITY'], summary: null };
    }
    if (issue && (review.issueId !== String(issue.id) || review.issueKey !== issue.key ||
        review.projectId !== String(issue.projectId) || review.projectKey !== issue.projectKey)) {
      return { ok: false, issues: ['REVIEW_IDENTITY_MISMATCH'], summary: null };
    }
    if (review.requirements.some(r => !nonempty(r.title) || r.versions.some(v => !metadata(v))) ||
        review.evidence.some(e => !nonempty(e.title) || !metadata(e)) ||
        review.approvals.some(a => !optionalText(a.note) || !metadata(a)) ||
        review.events.some(e => !metadata(e))) {
      return { ok: false, issues: ['INVALID_DISPLAY_FIELDS'], summary: null };
    }
    return { ok: true, issues: [], summary: summarize(review) };
  } catch {
    return { ok: false, issues: ['INVALID_REVIEW_STRUCTURE'], summary: null };
  }
}

// Do not disclose the invalid stored payload in a resolver error.
export function requireReviewForUse(review, issue) {
  const read = readReviewForUse(review, issue);
  if (!read.ok) throw new Error('REVIEW_INSPECTION_REQUIRED');
  return read.summary;
}

// The caller has already authorized access to the Jira issue. Never show
// a stored identity or status when the record fails inspection. Counts
// are placeholders, explicitly suppressed by both Forge table consumers.
export function storedReviewRow(review, issue) {
  const read = readReviewForUse(review, issue);
  if (!read.ok) return { issueKey: issue.key, summary: issue.summary,
    status: 'inspection-required', covered: 0, mandatory: 0 };
  return { issueKey: review.issueKey, summary: review.summary,
    status: read.summary.status, covered: read.summary.covered, mandatory: read.summary.mandatory };
}
