// Versioned, read-only diagnostic for web, PDF and JSON reports.
// Do not interpret recorded passing evidence as independently verified tests.
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
  return { schemaVersion: 1, diagnostic, comparison };
}

/**
 * Guard both consumers against unavailable or mismatched snapshot summaries.
 * The caller supplies all three projections from the same loaded review.
 * @param {{revision: number}} review
 * @param {{status: string, mandatory: number, covered: number}} summary
 * @param {ReturnType<typeof buildReportDiagnostic>} report
 */
export function canPublishReport(review, summary, report) {
  const d = report.diagnostic;
  return d.kind === 'available' && d.revision === review.revision &&
    d.impact.status === summary.status && d.impact.mandatory === summary.mandatory &&
    d.impact.covered === summary.covered;
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
