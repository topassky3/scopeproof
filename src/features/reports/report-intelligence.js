// Versioned, read-only diagnostic for web, PDF and JSON reports.
// Do not interpret recorded passing evidence as independently verified tests.
import { summarize } from '../../domain.js';
import { matchesReviewSource } from '../../shared/review-intelligence.js';
import { sameRecordValue } from '../../shared/record-equality.js';

/** @type {WeakMap<object, {intelligence: import('../../shared/review-intelligence.js').ReviewIntelligence, report: unknown}>} */
const origins = new WeakMap();

/** @param {import('../../shared/review-intelligence.js').ReviewIntelligence} intelligence */
export function buildReportDiagnostic(intelligence) {
  const diagnostic = structuredClone(intelligence);
  // Only compare recovery of a prior approval, under fixed current scope.
  // The baseline is hypothetical: one passing evidence operation per
  // mandatory requirement plus one explicit approval, with equal unit costs.
  const comparison = diagnostic.kind === 'available' &&
    diagnostic.plan.disposition === 'revalidate' &&
    diagnostic.impact.mandatory > 0 && diagnostic.plan.minimumActions !== null
    ? {
      baseline: 'all-mandatory-evidence-plus-approval',
      fullOperations: diagnostic.impact.mandatory + 1,
      minimalOperations: diagnostic.plan.minimumActions,
      avoidedOperations: diagnostic.impact.mandatory + 1 - diagnostic.plan.minimumActions,
      theoretical: true,
    } : null;
  const report = { schemaVersion: 1, diagnostic, comparison };
  if (diagnostic.kind === 'available') {
    origins.set(report, { intelligence, report: structuredClone(report) });
  }
  return report;
}

/**
 * Require exact provenance and complete summary equality before publication.
 * A deserialized or manually constructed diagnostic is not a live projection.
 * @param {{revision: number}} review
 * @param {{status: string, mandatory: number, covered: number}} summary
 * @param {ReturnType<typeof buildReportDiagnostic>} report
 */
export function canPublishReport(review, summary, report) {
  try {
    if (!report || report.diagnostic.kind !== 'available') return false;
    const origin = origins.get(report);
    return Boolean(origin && matchesReviewSource(origin.intelligence, review) &&
      sameRecordValue(origin.report, report) &&
      sameRecordValue(origin.intelligence, report.diagnostic) &&
      sameRecordValue(summarize(review), summary));
  } catch { return false; }
}

/** Preserve the existing JSON fields and add a detached, versioned diagnostic.
 * @template {{revision: number}} R
 * @template {{status: string, mandatory: number, covered: number}} S
 * @param {R} review
 * @param {S} summary
 * @param {ReturnType<typeof buildReportDiagnostic>} report
 * @param {string} generatedAt
 */
export function buildJsonReport(review, summary, report, generatedAt) {
  if (!canPublishReport(review, summary, report)) throw new Error('REPORT_INSPECTION_REQUIRED');
  return structuredClone({ generatedAt, review, coverage: summary, reportIntelligence: report });
}
