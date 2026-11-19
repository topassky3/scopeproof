import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardList,
  FileCheck2, FileClock, FilePlus2, History, Plus, Search, ShieldCheck,
} from 'lucide-react';
import { CoverageBar, Panel, StatusBadge } from '../../shared/components/ui';
import type { OpenEditor, ReviewData, ReviewSummary, RequirementRow } from '../../shared/types/review';
import { evidenceOverview, findRequirements, requirementMetrics } from './requirements-view.mjs';
import './requirements.css';

type RequirementsPageProps = {
  summary: ReviewSummary;
  review: ReviewData;
  openEditor: OpenEditor;
};

function Metric({ icon: Icon, number, label, detail }: {
  icon: typeof ClipboardList;
  number: string | number;
  label: string;
  detail: string;
}) {
  return <div className="rq-metric">
    <span className="rq-metric-icon"><Icon size={20} aria-hidden="true" /></span>
    <span className="rq-metric-copy"><strong>{number}</strong><b>{label}</b><small>{detail}</small></span>
  </div>;
}

function EvidenceLabel({ state }: { state: string }) {
  const label = state === 'satisfied' ? 'Current'
    : state === 'stale' ? 'Outdated'
    : state === 'failed' ? 'Failed'
    : 'Missing';
  return <span className={'rq-evidence rq-evidence-' + label.toLowerCase()}>
    {label === 'Current' ? <CheckCircle2 size={14} aria-hidden="true" />
      : <FileClock size={14} aria-hidden="true" />}
    {label}
  </span>;
}

function RequirementsTable({ rows, selectedId, select, openEditor }: {
  rows: RequirementRow[];
  selectedId: string | undefined;
  select: (id: string) => void;
  openEditor: OpenEditor;
}) {
  return <div className="table-wrap">
    <table className="rq-table">
      <thead><tr><th scope="col">ID</th><th scope="col">Description</th>
        <th scope="col">Version</th><th scope="col">Evidence</th>
        <th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className={row.id === selectedId ? 'rq-selected' : ''}>
        <td data-label="ID"><button type="button" className="rq-link"
          aria-pressed={row.id === selectedId} onClick={() => select(row.id)}>{row.id}</button></td>
        <td data-label="Description" className="rq-description">
          <b>{row.title}</b>
          <span className={'rq-kind ' + (row.mandatory ? 'rq-kind-mandatory' : '')}>
            {row.mandatory ? 'Mandatory' : 'Optional'}
          </span>
        </td>
        <td data-label="Version"><span className="version">v{row.version}</span></td>
        <td data-label="Evidence"><EvidenceLabel state={row.state} /></td>
        <td data-label="Status"><StatusBadge state={row.state}/></td>
        <td data-label="Actions"><div className="inline-actions rq-actions">
          <button type="button" onClick={() => openEditor('version', row.id)}
            aria-label={'New version for ' + row.id}>New version</button>
          <button type="button" onClick={() => openEditor('evidence', row.id)}
            aria-label={'Add evidence for ' + row.id}>Add evidence</button>
        </div></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function RequirementsPage({ summary, review, openEditor }: RequirementsPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const metrics = requirementMetrics(summary);
  const matching = useMemo(() => findRequirements(summary.rows, search, filter) as RequirementRow[],
    [summary.rows, search, filter]);
  const selected = summary.rows.find(row => row.id === selectedId) ?? summary.rows[0];
  const evidence = selected ? evidenceOverview(selected, review.evidence ?? []) : null;
  const hasDecision = review.approvals.length > 0;
  const requiresAttention = metrics.attention > 0;

  return <div className="rq-page">
    <section className="rq-overview" aria-label="Requirements overview">
      <Metric icon={ClipboardList} number={metrics.total} label="Requirements"
        detail={metrics.optional + ' optional'} />
      <Metric icon={ShieldCheck} number={metrics.mandatory} label="Mandatory"
        detail="Checks for approval" />
      <Metric icon={FileCheck2} number={String(metrics.covered) + '/' + metrics.mandatory}
        label="Coverage" detail="Current passed evidence" />
      <Metric icon={FileClock} number={metrics.attention} label="Need attention"
        detail="Mandatory checks pending" />
    </section>

    <section className={'rq-notice ' + (requiresAttention ? 'rq-notice-alert' : 'rq-notice-good')}
      aria-label="Review impact">
      {requiresAttention ? <AlertTriangle size={20} aria-hidden="true" />
        : <CheckCircle2 size={20} aria-hidden="true" />}
      <div>
        <strong>{summary.status === 'revalidation'
          ? 'Prior approval requires revalidation'
          : requiresAttention ? 'Evidence is needed before approval'
          : summary.status === 'approved' ? 'Current requirements are approved'
          : 'All mandatory requirements have valid evidence'}</strong>
        <p>{requiresAttention
          ? metrics.attention + ' mandatory requirement(s) need current passing evidence. Earlier test results stay in history.'
          : summary.status === 'approved'
            ? 'The latest decision applies to the current evidence snapshot.'
            : 'Approval still requires an explicit reviewer decision.'}</p>
      </div>
    </section>

    <Panel title="Requirements" className="rq-panel"
      aside={<span>{matching.length} of {metrics.total} requirements</span>}>
      <div className="rq-toolbar">
        <label className="rq-search">
          <Search size={18} aria-hidden="true" />
          <span className="rq-visually-hidden">Search requirements</span>
          <input value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search ID or description" aria-label="Search requirements" />
        </label>
        <label className="rq-filter">Evidence status
          <select value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="attention">Needs attention</option>
            <option value="satisfied">Current</option>
            <option value="stale">Outdated</option>
            <option value="missing">Missing</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>
      {matching.length ? <RequirementsTable rows={matching}
        selectedId={selected?.id} select={setSelectedId} openEditor={openEditor} />
        : <div className="rq-no-matches">No requirements match your search or filter.</div>}
      {summary.rows.length === 0 && <p className="muted">Create your first requirement using New requirement above.</p>}
      <p className="rq-footnote">Select a requirement ID to inspect its current and historical evidence.</p>
    </Panel>

    <div className="rq-bottom">
      <Panel title="Requirement details" aside={selected && <span>{selected.id} · v{selected.version}</span>}
        className="rq-detail-panel">
        {selected && evidence ? <>
          <h3 className="rq-detail-title">{selected.title}</h3>
          <div className="rq-detail-meta">
            <span className="rq-kind">{selected.mandatory ? 'Mandatory' : 'Optional'}</span>
            <StatusBadge state={selected.state}/>
          </div>
          <div className="rq-evidence-box">
            <span className="rq-eyebrow">Evidence for current version</span>
            <div className="rq-evidence-heading"><EvidenceLabel state={selected.state} />
              <span>Version {selected.version}</span></div>
            <p>{evidence.description}</p>
            {evidence.current && <div className="rq-evidence-record">
              <b>{evidence.current.id}</b>
              <span>{evidence.current.title}</span>
              <small>{evidence.current.result === 'passed' ? 'Passed' : 'Failed'}</small>
            </div>}
            {evidence.previousCount > 0 && <p className="rq-previous">
              <History size={15} aria-hidden="true" />
              {evidence.previousCount} older evidence record(s) retained in history, not counted as current.
            </p>}
          </div>
          <div className="rq-detail-actions inline-actions">
            <button type="button" onClick={() => openEditor('version', selected.id)}>
              <Plus size={15} aria-hidden="true" /> New version</button>
            <button className="primary" type="button" onClick={() => openEditor('evidence', selected.id)}>
              <FilePlus2 size={15} aria-hidden="true" /> Add evidence</button>
          </div>
        </> : <p className="muted">Choose or create a requirement to see its details.</p>}
      </Panel>

      <Panel title="Change impact" className="rq-impact-panel">
        <div className="rq-flow" aria-label="Requirement change impact">
          <span>Requirement</span><ArrowRight size={15} aria-hidden="true" />
          <span>Evidence</span><ArrowRight size={15} aria-hidden="true" />
          <span>Approval</span>
        </div>
        <div className="rq-impact-total">
          <strong>{metrics.attention}</strong>
          <span>mandatory checks need attention</span>
        </div>
        <div className="rq-coverage"><span>Current mandatory coverage</span>
          <CoverageBar covered={metrics.covered} total={metrics.mandatory} /></div>
        {requiresAttention && <ul className="rq-blockers">
          {summary.blockers.map(item => <li key={item.id}>
            <b>{item.id}</b> · {item.state === 'stale' ? 'Outdated evidence'
              : item.state === 'failed' ? 'Latest evidence failed' : 'Evidence missing'}
          </li>)}
        </ul>}
        <p className="rq-impact-help">{hasDecision
          ? 'Previous decisions remain in review history when a requirement changes. New evidence does not automatically reapprove the review.'
          : 'Requirements and evidence determine whether an explicit approval can be made.'}</p>
      </Panel>
    </div>
    <div className="rq-preview-help">
      <ShieldCheck size={17} aria-hidden="true" />
      Changes in local preview update sample data only. They do not write to Django or Jira.
    </div>
  </div>;
}
