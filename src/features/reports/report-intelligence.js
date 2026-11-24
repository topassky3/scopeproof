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
