import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, ClipboardList, FileCheck2, FileClock, FileText, FlaskConical,
  GitCompareArrows, History, Layers3, Plus, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { CoverageBar, Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { AuditEvent, ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';
import { buildReviewRows, filterReviewRows, overviewMetrics, recentReviewActivity, reviewImpact } from './overview-model.js';
import './overview.css';

type Filter = 'all' | 'revalidation' | 'in-review' | 'approved' | 'pending' | 'rejected';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Reviews' | 'Requirements' | 'Evidence' | 'History') => void;
  onSelectIssue: (key: string) => void;
  onNewReview: () => void;
  onAddEvidence: (requirementId: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'revalidation', label: 'Revalidation' },
  { id: 'in-review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'pending', label: 'Pending' },
];
const PAGE_SIZE = 6;

function formatDate(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function OverviewPage({ review, summary, list, onNavigate, onSelectIssue, onNewReview, onAddEvidence }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => buildReviewRows(review, summary, list), [review, summary, list]);
  const metrics = useMemo(() => overviewMetrics(rows), [rows]);
  const filtered = useMemo(() => filterReviewRows(rows, search, filter), [rows, search, filter]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, maxPage);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const impact = useMemo(() => reviewImpact(review, summary), [review, summary]);
  const activity = useMemo(() => recentReviewActivity(review, 3), [review]);
  const nextRequirement = summary.blockers[0]?.id ?? summary.rows[0]?.id;
  const countFor = (id: Filter) => id === 'all' ? metrics.total : id === 'in-review'
    ? metrics.inReview : id === 'revalidation' ? metrics.revalidation
    : id === 'approved' ? metrics.approved : id === 'pending' ? metrics.pending : metrics.rejected;

  return <div className="ov-dashboard">
    <div className="ov-layout">
      <div className="ov-primary">
        <div className="ov-heading-row">
          <p className="ov-eyebrow">PROJECT HEALTH</p>
          <button type="button" className="primary ov-new-review" onClick={onNewReview}><Plus size={16}/> Open Jira issue</button>
        </div>
        <div className="metrics ov-metrics" aria-label="Project review summary">
          <StatCard value={metrics.approved} label="Approved" icon={CheckCircle2} tone="good"/>
          <StatCard value={metrics.inReview} label="In review" icon={Layers3}/>
          <StatCard value={metrics.revalidation} label="Revalidation" icon={RefreshCw} tone="bad"/>
          <StatCard value={metrics.pending} label="Pending" icon={Clock3} tone="muted"/>
        </div>
        {metrics.revalidation > 0 && <button type="button" className="ov-attention" onClick={() => { setFilter('revalidation'); setPage(1); }}>
          <span className="ov-attention-icon"><AlertTriangle size={22}/></span>
          <span><strong>{metrics.revalidation} review{metrics.revalidation === 1 ? '' : 's'} need revalidation</strong><small>Evidence linked to an older requirement version may no longer be sufficient.</small></span>
          <ArrowRight size={19} aria-hidden="true"/>
        </button>}
        <Panel title="Issue reviews" className="ov-table-panel" aside={<span>{metrics.total} tracked</span>}>
          <div className="ov-tabs" role="group" aria-label="Filter reviews by status">
            {FILTERS.map(item => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''}
              aria-pressed={filter === item.id} onClick={() => {setFilter(item.id);setPage(1);}}>
              {item.label} <span>{countFor(item.id)}</span>
            </button>)}
          </div>
          <div className="ov-toolbar">
            <label className="ov-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Search Jira issue reviews</span>
              <input type="search" placeholder="Search issue or summary" value={search} onChange={event => {setSearch(event.target.value);setPage(1);}}/>
            </label>
            <span className="ov-filter-caption">Showing saved Scopeproof reviews</span>
          </div>
          <div className="table-wrap"><table className="ov-table">
            <thead><tr><th>Issue</th><th>Summary</th><th>Review status</th><th>Coverage</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{pageRows.map((item: ReviewListItem) => <tr key={item.issueKey} className={item.issueKey === review.issueKey ? 'row-selected' : ''}>
              <td><button type="button" className="ov-issue-link" onClick={() => onSelectIssue(item.issueKey)}>{item.issueKey}</button></td>
              <td className="ov-summary-cell" title={item.summary}>{item.summary}</td>
              <td><StatusBadge state={item.status}/></td>
              <td><CoverageBar covered={item.covered} total={item.mandatory}/></td>
              <td><button type="button" className="icon-btn" aria-label={`Open review ${item.issueKey}`} onClick={() => onSelectIssue(item.issueKey)}><ArrowRight size={17}/></button></td>
            </tr>)}</tbody>
          </table></div>
          {pageRows.length === 0 && <div className="ov-empty"><ClipboardList size={25}/><b>No matching reviews</b><span>Try another search or review status.</span></div>}
          <div className="ov-pagination"><span>{filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17}/></button>
              <span>Page {currentPage} of {maxPage}</span>
              <button type="button" aria-label="Next page" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17}/></button></div>
          </div>
        </Panel>
      </div>
      <aside className="ov-aside" aria-label="Selected review details">
        <Panel className="ov-detail-card">
          <div className="ov-issue-heading"><div><span className="ov-issue-marker"><FileCheck2 size={20}/></span><button className="ov-issue-link ov-issue-heading-link" onClick={() => onNavigate('Reviews')} type="button">{review.issueKey}</button></div><StatusBadge state={summary.status}/></div>
          <h2 className="ov-issue-summary">{review.summary}</h2>
          {summary.status === 'revalidation' && <div className="ov-warning"><RefreshCw size={20}/><div><b>Revalidation required</b><span>One or more requirements need current evidence.</span></div></div>}
          <div className="ov-section-label"><span>Requirement coverage</span><b>{summary.covered} / {summary.mandatory}</b></div>
          <div className="ov-large-coverage"><CoverageBar covered={summary.covered} total={summary.mandatory}/></div>
          <div className="ov-requirement-list">{summary.rows.map(row => <div key={row.id} className="ov-requirement-row"><FileText size={16}/><b>{row.id}</b><span className="version">v{row.version}</span><StatusBadge state={row.state}/></div>)}</div>
          {summary.rows.length === 0 && <p className="muted">No requirements have been added to this review.</p>}
          <div className="ov-actions"><button type="button" className="primary" onClick={() => onNavigate('Reviews')}>Open review <ArrowRight size={15}/></button>
            <button type="button" disabled={!nextRequirement} onClick={() => nextRequirement && onAddEvidence(nextRequirement)}><Plus size={15}/> Add evidence</button></div>
        </Panel>
        <Panel title="Change impact" className="ov-impact-card" aside={<GitCompareArrows size={19}/> }>
          <div className="ov-impact-flow" aria-label="Requirement and evidence change flow">
            <span><FileText size={22}/><small>Requirement</small></span><ArrowRight size={16}/><span><FlaskConical size={22}/><small>Evidence</small></span><ArrowRight size={16}/><span><ShieldCheck size={22}/><small>Approval</small></span><ArrowRight size={16}/><span className={impact.approvalsToRevalidate ? 'is-stale' : ''}><RefreshCw size={22}/><small>Check</small></span>
          </div>
          <div className="ov-impact-numbers">
            <div><b>{impact.staleRequirements}</b><span>Stale requirements</span></div>
            <div><b>{impact.outdatedEvidence}</b><span>Outdated evidence</span></div>
            <div><b>{impact.approvalsToRevalidate}</b><span>Approvals to revisit</span></div>
          </div>
          {impact.affected ? <p className="ov-impact-note"><strong>{impact.affected.id} v{impact.affected.version}</strong> needs new evidence for its current version.</p>
            : <p className="ov-impact-note">Historical approvals and evidence remain traceable.</p>}
          <button className="ov-text-link" type="button" onClick={() => onNavigate('History')}>View audit history <ArrowRight size={14}/></button>
        </Panel>
        <Panel title="Recent activity" className="ov-activity-card" aside={<button className="ov-text-link" type="button" onClick={() => onNavigate('History')}>View all</button>}>
          <ol className="ov-timeline">{activity.map((event: AuditEvent) => <li key={event.id}><span className="ov-timeline-dot"><FileClock size={16}/></span><div><strong>{event.description}</strong><small>{event.actor} · {formatDate(event.createdAt)}</small></div></li>)}</ol>
          {activity.length === 0 && <p className="muted"><History size={16}/> No recorded activity yet.</p>}
        </Panel>
      </aside>
    </div>
  </div>;
}
