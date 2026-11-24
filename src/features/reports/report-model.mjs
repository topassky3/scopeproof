// Read-only projection: domain.js remains authoritative for coverage and approval.
import { buildEvidenceRows, evidenceMetrics } from '../evidence/evidence-model.mjs';
import { historyRows, historyMetrics, eventDetail } from '../history/history-model.mjs';

export function buildReport(review, summary) {
  const evidence = buildEvidenceRows(review);
  const history = historyRows(review);
  return {
    coveragePercent: summary.mandatory > 0 ? summary.covered / summary.mandatory * 100 : null,
    evidence,
    evidenceCounts: evidenceMetrics(evidence),
    historyCounts: historyMetrics(history),
    decisions: history.filter(row => row.category === 'decisions').map(row => ({
      ...row, detail: eventDetail(review, row.event),
    })),
    activeRevalidation: summary.status === 'revalidation',
  };
}
