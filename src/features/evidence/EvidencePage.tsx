import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, FileClock, FileText,
  History, Link2, Plus, Search, ShieldCheck, XCircle,
} from 'lucide-react';
import { CoverageBar, Panel, StatusBadge } from '../../shared/components/ui';
import type { OpenEditor, ReviewData, ReviewSummary } from '../../shared/types/review';
import { actorLabel } from '../../shared/actors/actor-names.mjs';
import { buildEvidenceRows, evidenceMetrics, filterEvidenceRows } from './evidence-model.mjs';
import type { EvidenceViewRow } from './evidence-model.mjs';
import './evidence.css';

interface EvidencePageProps {
  review: ReviewData;
  summary: ReviewSummary;
  openEditor: OpenEditor;
  actorNames?: Record<string, string>;
}

function ResultTag({ result }: { result: 'passed' | 'failed' }) {
  return <span className={'ev-tag ev-result-' + result}>
    {result === 'passed' ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
    {result === 'passed' ? 'Passed' : 'Failed'}
  </span>;
}

function ApplicabilityTag({ state }: { state: EvidenceViewRow['applicability'] }) {
  const labels = { current: 'Current', outdated: 'Outdated', superseded: 'Superseded', unknown: 'Unknown' };
  return <span className={'ev-tag ev-app-' + state}><FileClock size={14} aria-hidden="true" />{labels[state]}</span>;
}

function RecordDate({ value }: { value?: string }) {
  if (!value) return <span className="muted">Not recorded</span>;
  const date = new Date(value);
  return <time dateTime={value} className="ev-record-date">{Number.isNaN(date.getTime())
    ? value
    : <><span>{date.toLocaleDateString()}</span>{' '}<span>{date.toLocaleTimeString()}</span></>}</time>;
}

export function EvidencePage({ review, summary, openEditor, actorNames = {} }: EvidencePageProps) {
  const rows = useMemo(() => buildEvidenceRows(review), [review]);
  const metrics = useMemo(() => evidenceMetrics(rows), [rows]);
  const [query, setQuery] = useState('');
  const [applicability, setApplicability] = useState('all');
  const [testResult, setTestResult] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const matches = useMemo(() => filterEvidenceRows(rows, query, applicability, testResult),
    [rows, query, applicability, testResult]);
  const selected = matches.find(row => row.id === selectedId) ?? matches[0];
  const selectedRequirement = review.requirements.find(row => row.id === selected?.requirementId);
  const targetRequirementId = requirementId || selected?.requirementId || review.requirements[0]?.id || '';
  const needsReview = summary.blockers.length > 0 || summary.mandatory === 0 || summary.status === 'revalidation';

  function selectRow(row: EvidenceViewRow) {
    setSelectedId(row.id);
    setRequirementId(row.requirementId);
  }

  return <div className="ev-page">
    <section className="ev-metrics" aria-label="Evidence overview">
      <div className="ev-metric"><FileText aria-hidden="true" /><div><strong>{metrics.total}</strong><b>Evidence records</b><small>Stored in this review</small></div></div>
      <div className="ev-metric"><ClipboardCheck aria-hidden="true" /><div><strong>{metrics.current}</strong><b>Latest current</b><small>One per requirement version</small></div></div>
      <div className="ev-metric"><FileClock aria-hidden="true" /><div><strong>{metrics.outdated}</strong><b>Outdated</b><small>Previous requirement versions</small></div></div>
      <div className="ev-metric"><XCircle aria-hidden="true" /><div><strong>{metrics.failedCurrent}</strong><b>Current failures</b><small>Latest failed test results</small></div></div>
    </section>

    <section className={'ev-notice ' + (needsReview ? 'ev-notice-alert' : 'ev-notice-ok')} aria-label="Evidence impact">
      {needsReview ? <AlertTriangle size={21} aria-hidden="true" /> : <ShieldCheck size={21} aria-hidden="true" />}
      <div><strong>{summary.mandatory === 0
        ? 'Add a mandatory requirement to begin'
        : summary.status === 'revalidation'
          ? 'Prior approval requires revalidation'
          : summary.blockers.length
            ? summary.blockers.length + ' mandatory requirement(s) lack passing current evidence'
            : 'All mandatory requirements have passing current evidence'}</strong>
        <p>{summary.mandatory === 0
          ? 'At least one mandatory requirement and current passing evidence are needed before approval.'
          : summary.status === 'revalidation'
            ? 'Evidence does not automatically renew an earlier approval. An authorized reviewer must decide again.'
            : 'Evidence result and applicability are different. A passed test for an older version does not count towards approval.'}</p>
      </div>
    </section>

    <Panel title="Evidence records" className="ev-panel"
      aside={<span>{matches.length} of {metrics.total} records</span>}>
      <div className="ev-toolbar">
        <label className="ev-search"><Search size={17} aria-hidden="true" />
          <span className="ev-sr-only">Search evidence</span>
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search evidence, title or requirement" aria-label="Search evidence" /></label>
        <label className="ev-select">Applicability
          <select value={applicability} onChange={event => setApplicability(event.target.value)}>
            <option value="all">All</option><option value="current">Current</option>
            <option value="outdated">Outdated</option><option value="superseded">Superseded</option>
            <option value="unknown">Unknown</option>
          </select></label>
        <label className="ev-select">Test result
          <select value={testResult} onChange={event => setTestResult(event.target.value)}>
            <option value="all">All</option><option value="passed">Passed</option><option value="failed">Failed</option>
          </select></label>
      </div>

      {matches.length ? <div className="table-wrap"><table className="ev-table">
        <thead><tr><th scope="col">Evidence</th><th scope="col">Requirement</th>
          <th scope="col">Result</th><th scope="col">Applicability</th>
          <th scope="col">Recorded</th><th scope="col">Reference</th></tr></thead>
        <tbody>{matches.map(row => <tr key={row.id} className={selected?.id === row.id ? 'ev-selected' : ''}>
          <td data-label="Evidence"><button type="button" className="ev-link"
            aria-pressed={selected?.id === row.id} onClick={() => selectRow(row)}>{row.id}</button>
            <span className="ev-title">{row.title}</span></td>
          <td data-label="Requirement"><b>{row.requirementId}</b> · v{row.version}
            <span className="ev-subtitle">{row.requirementTitle}</span></td>
          <td data-label="Result"><ResultTag result={row.result} /></td>
          <td data-label="Applicability"><ApplicabilityTag state={row.applicability} /></td>
          <td data-label="Recorded"><RecordDate value={row.createdAt} /></td>
          <td data-label="Reference">{/^https:\/\//i.test(row.url ?? '')
            ? <a href={row.url} target="_blank" rel="noopener noreferrer">Open link <Link2 size={13} aria-hidden="true" /></a>
            : <span className="muted">No link</span>}</td>
        </tr>)}</tbody>
      </table></div> : <div className="ev-empty">No evidence matches these filters. Try another search or status.</div>}
      <p className="ev-footnote">Select an evidence ID to inspect its relationship to the current requirement version.</p>
    </Panel>

    <div className="ev-bottom">
      <Panel title="Evidence details" aside={selected && <span>{selected.id}</span>} className="ev-detail">
        {selected ? <>
          <h3>{selected.title}</h3>
          <div className="ev-tags"><ResultTag result={selected.result} /><ApplicabilityTag state={selected.applicability} /></div>
          <dl className="ev-details-list">
            <div><dt>Requirement</dt><dd>{selected.requirementId} · v{selected.version}</dd></div>
            <div><dt>Version description</dt><dd>{selected.requirementTitle}</dd></div>
            {selected.currentRequirementTitle && selected.currentVersion !== selected.version &&
              <div><dt>Current description</dt><dd>{selected.currentRequirementTitle}</dd></div>}
            <div><dt>Current version</dt><dd>{selected.currentVersion === null ? 'Unavailable' : 'v' + selected.currentVersion}</dd></div>
            <div><dt>Type</dt><dd>{selected.mandatory ? 'Mandatory' : 'Optional'}</dd></div>
            <div><dt>Recorded by</dt><dd title={selected.actor || undefined}>{actorLabel(selected.actor, actorNames)}</dd></div>
            <div><dt>Date</dt><dd><RecordDate value={selected.createdAt} /></dd></div>
          </dl>
          <div className="ev-detail-note">
            {selected.applicability === 'outdated'
              ? 'Historical evidence: kept for audit, but it does not cover the current requirement version.'
              : selected.applicability === 'superseded'
                ? 'A newer test exists for this same requirement version. Only the latest result determines coverage.'
                : selected.applicability === 'current' && selected.result === 'failed'
                  ? 'Latest test failed. A prior passing test cannot override this failure.'
                  : selected.applicability === 'current'
                    ? 'Latest evidence for the current requirement version. Approval still requires an explicit decision.'
                    : 'Requirement reference or version could not be matched.'}
          </div>
          {selectedRequirement && <p className="ev-requirement-state">Requirement status: <StatusBadge state={summary.rows.find(r => r.id === selectedRequirement.id)?.state || 'missing'} /></p>}
        </> : <p className="muted">{rows.length ? 'No evidence matches the current filters.' : 'No evidence yet. Add a test result to get started.'}</p>}
      </Panel>
      <Panel title="Coverage & new evidence" className="ev-actions-panel">
        <div className="ev-coverage"><span>Mandatory requirement coverage</span>
          <CoverageBar covered={summary.covered} total={summary.mandatory} /></div>
        <p className="ev-context">Add a new test result to the latest version of a requirement. Historical records remain unchanged.</p>
        <label className="ev-select ev-target">Target requirement
          <select value={targetRequirementId} onChange={event => setRequirementId(event.target.value)}>
            {review.requirements.map(requirement =>
              <option key={requirement.id} value={requirement.id}>{requirement.id} · v{requirement.version} — {requirement.title}</option>)}
          </select></label>
        <button type="button" className="primary ev-add-button"
          disabled={!targetRequirementId} onClick={() => openEditor('evidence', targetRequirementId)}>
          <Plus size={16} aria-hidden="true" /> Add evidence</button>
        {summary.status === 'revalidation' && <p className="ev-revalidation"><History size={15} aria-hidden="true" /> A previous approval requires revalidation. New evidence will not automatically approve it.</p>}
      </Panel>
    </div>
    {import.meta.env.DEV && <p className="ev-preview-help"><ShieldCheck size={16} aria-hidden="true" /> Local preview changes sample data only. Django and Jira are not modified.</p>}
  </div>;
}
