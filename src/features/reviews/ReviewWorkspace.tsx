import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, GitCompare, RefreshCw, Search } from 'lucide-react';
import { CoverageBar, Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';
import { buildReviewRows, filterReviewRows, reviewMetrics } from './review-list-model.mjs';
import './reviews-workspace.css';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'History') => void;
  onSelectIssue: (key: string) => void;
}

/** Integrates Lopera's tested list and status filters within Scopeproof's single navigation shell. */
export function ReviewWorkspace({ review, summary, list, onNavigate, onSelectIssue }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(() => buildReviewRows(review, summary, list), [review, summary, list]);
  const filtered = useMemo(() => filterReviewRows(rows, search, status), [rows, search, status]);
  const metrics = useMemo(() => reviewMetrics(rows), [rows]);

  return <>
    <div className="metrics">
      <StatCard value={metrics.reviews} label="Reviews" icon={ClipboardCheck}/>
      <StatCard value={metrics.approved} label="Approved" icon={CheckCircle2} tone="good"/>
      <StatCard value={metrics.revalidation} label="Revalidation" icon={RefreshCw} tone="bad"/>
      <StatCard value={metrics.notFinalized} label="Not finalized" icon={Clock3}/>
    </div>
    {summary.status === 'revalidation' && <button type="button" className="attention" onClick={() => onNavigate('Requirements')}>
      <AlertTriangle size={20}/><strong>{review.issueKey}</strong>
      <span>Prior approval requires revalidation</span><StatusBadge state="revalidation"/><ArrowRight size={18}/>
    </button>}
    <Panel title="Issue reviews" aside={<span>{filtered.length} found</span>}>
      <div className="sp-review-toolbar">
        <label className="sp-review-search">
          <Search size={17} aria-hidden="true"/>
          <span className="sr-only">Search issue or summary</span>
          <input type="search" value={search} placeholder="Search issue or summary"
            onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="sp-review-status">Status
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="revalidation">Revalidation required</option>
            <option value="ready">Ready to approve</option>
            <option value="in-review">In review</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
          </select>
        </label>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>Issue</th><th>Summary</th><th>Review status</th><th>Coverage</th><th>Action</th>
      </tr></thead><tbody>{filtered.map(row => <tr key={row.issueKey} className={row.issueKey === review.issueKey ? 'row-selected' : ''}>
        <td className="link">{row.issueKey}</td><td>{row.summary}</td>
        <td><StatusBadge state={row.status}/></td>
        <td><CoverageBar covered={row.covered} total={row.mandatory}/></td>
        <td><button type="button" className="icon-btn" aria-label={`Open ${row.issueKey}`} onClick={() => onSelectIssue(row.issueKey)}><ArrowRight size={17}/></button></td>
      </tr>)}</tbody></table></div>
      {filtered.length === 0 && <p className="sp-review-empty">No reviews match the selected filters.</p>}
    </Panel>
    <div className="split">
      <Panel title="Selected review" aside={<StatusBadge state={summary.status}/>}>
        <h3>{review.issueKey} · {review.summary}</h3>
        <div className="coverage-large"><CoverageBar covered={summary.covered} total={summary.mandatory}/></div>
        <div className="stack">{summary.rows.map(row => <div className="stack-line" key={row.id}>
          <span><b>{row.id}</b> <small>v{row.version}</small> {row.title}</span><StatusBadge state={row.state}/>
        </div>)}</div>
        {!summary.rows.length && <p className="muted">No requirements yet. Add one in Requirements.</p>}
        <div className="footer-actions"><button type="button" className="primary" onClick={() => onNavigate('Requirements')}>Open requirements <ArrowRight size={15}/></button><button type="button" onClick={() => onNavigate('History')}>View history</button></div>
      </Panel>
      <Panel title="Change impact" aside={<GitCompare size={20}/>}>
        <div className="impact-flow"><span>Requirement</span><ArrowRight/><span>Evidence</span><ArrowRight/><span>Approval</span></div>
        <div className="impact-stat"><strong>{summary.blockers.length}</strong><span>mandatory checks need attention</span></div>
        <p className="muted">Previous approvals remain in the history even when requirements change.</p>
      </Panel>
    </div>
  </>;
}
