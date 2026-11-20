import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Clock3, FileCheck2, FileText, History, Layers3,
  Plus, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { CoverageBar, Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { AuditEvent, ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';
import { buildReviewRows, filterReviewRows, overviewMetrics, recentReviewActivity, reviewImpact } from '../overview/overview-model.js';
import { actorLabel } from '../../shared/actors/actor-names.mjs';
import { latestReviewDecision, reviewActionMessage } from './reviews-model.mjs';
import './reviews.css';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'Evidence' | 'History') => void;
  onSelectIssue: (key: string) => void;
  onNewReview: () => void;
  actorNames?: Record<string, string>;
}
type Filter = 'all' | 'approved' | 'revalidation' | 'in-review' | 'pending' | 'rejected';
const FILTERS: { id: Filter; label: string }[] = [
  { id:'all',label:'All' }, { id:'approved',label:'Approved' },
  { id:'revalidation',label:'Revalidation' }, { id:'in-review',label:'In progress' },
  { id:'pending',label:'Pending' }, { id:'rejected',label:'Rejected' },
];
const PAGE_SIZE = 6;
const formatDate = (value: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded'
    : date.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
};

export function ReviewWorkspace({
  review, summary, list, onNavigate, onSelectIssue, onNewReview, actorNames = {},
}: Props) {
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<Filter>('all');
  const [page,setPage] = useState(1);
  const rows = useMemo(() => buildReviewRows(review, summary, list), [review,summary,list]);
  const metrics = useMemo(() => overviewMetrics(rows), [rows]);
  const visible = useMemo(() => filterReviewRows(rows,query,filter), [rows,query,filter]);
  const pageCount = Math.max(1,Math.ceil(visible.length/PAGE_SIZE));
  const currentPage = Math.min(page,pageCount);
  const pageRows = visible.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const decision = useMemo(() => latestReviewDecision(review), [review]);
  const impact = useMemo(() => reviewImpact(review,summary), [review,summary]);
  const events = useMemo(() => recentReviewActivity(review,3), [review]);
  const needsAttention = summary.status === 'revalidation' || summary.status === 'rejected' || summary.blockers.length > 0 || summary.mandatory === 0;
  const countFor = (id: Filter) => id === 'all' ? metrics.total
    : id === 'in-review' ? metrics.inReview
    : metrics[id];

  return <div className="rw-page">
    <div className="rw-intro">
      <div><p className="rw-eyebrow">REVIEW WORKSPACE</p>
        <p className="rw-lead">Review the latest Jira evidence, requirements and decisions in one place.</p></div>
      <button type="button" className="primary rw-open" onClick={onNewReview}>
        <Plus size={16} aria-hidden="true"/> Open Jira issue
      </button>
    </div>
    <section className="metrics rw-metrics" aria-label="Review overview">
      <StatCard value={metrics.total} label="Tracked" icon={ClipboardCheck}/>
      <StatCard value={metrics.approved} label="Approved" icon={CheckCircle2} tone="good"/>
      <StatCard value={metrics.revalidation} label="Revalidation" icon={RefreshCw} tone="bad"/>
      <StatCard value={metrics.inReview} label="In progress" icon={Layers3}/>
    </section>
    <section className={'rw-alert' + (needsAttention ? ' rw-alert-attention' : ' rw-alert-ok')}
      aria-label="Selected review status">
      {needsAttention ? <AlertTriangle size={21} aria-hidden="true"/> : <ShieldCheck size={21} aria-hidden="true"/>}
      <div><strong>{summary.status === 'revalidation' ? 'Explicit reapproval required'
        : summary.mandatory === 0 ? 'No mandatory requirements yet'
        : summary.blockers.length ? 'Some mandatory requirements lack passing evidence'
        : summary.status === 'approved' ? 'Current review approved'
        : summary.status === 'rejected' ? 'Review rejected'
        : 'Review ready for decision'}</strong>
        <p>{reviewActionMessage(summary)}</p>
      </div>
      <button type="button" onClick={() => onNavigate('Requirements')}>Requirements <ArrowRight size={14}/></button>
    </section>

    <Panel title="Issue reviews" className="rw-table-panel" aside={<span>{visible.length} of {metrics.total} tracked</span>}>
      <div className="rw-controls">
        <label className="rw-search"><Search size={17} aria-hidden="true"/>
          <input aria-label="Search issue reviews" type="search" value={query}
            placeholder="Search issue key or summary"
            onChange={event => {setQuery(event.target.value);setPage(1);}}/>
        </label>
        <label className="rw-status-control">Status
          <select aria-label="Filter reviews by status" value={filter}
            onChange={event => {setFilter(event.target.value as Filter);setPage(1);}}>
            {FILTERS.map(item => <option key={item.id} value={item.id}>{item.label} ({countFor(item.id)})</option>)}
          </select>
        </label>
      </div>
      {pageRows.length ? <div className="table-wrap"><table className="rw-table">
        <thead><tr><th scope="col">Issue</th><th scope="col">Summary</th>
          <th scope="col">Review status</th><th scope="col">Coverage</th>
          <th scope="col">Action</th></tr></thead>
        <tbody>{pageRows.map(item => <tr key={item.issueKey} className={item.issueKey === review.issueKey ? 'rw-selected' : ''}>
          <td data-label="Issue"><button type="button" className="rw-link"
            onClick={() => onSelectIssue(item.issueKey)}>{item.issueKey}</button></td>
          <td data-label="Summary" className="rw-summary" title={item.summary}>{item.summary}</td>
          <td data-label="Status"><StatusBadge state={item.status}/></td>
          <td data-label="Coverage"><CoverageBar covered={item.covered} total={item.mandatory}/></td>
          <td data-label="Action"><button type="button" className="rw-row-action"
            aria-label={'Open review ' + item.issueKey} onClick={() => onSelectIssue(item.issueKey)}>
            Open <ArrowRight size={14} aria-hidden="true"/></button></td>
        </tr>)}</tbody>
      </table></div> : <div className="rw-empty"><Search size={24}/><strong>No matching reviews</strong>
        <span>Change the search or status filter to find a saved review.</span></div>}
      <div className="rw-pagination">
        <span>{visible.length ? (currentPage-1)*PAGE_SIZE+1 : 0}–{Math.min(currentPage*PAGE_SIZE,visible.length)} of {visible.length}</span>
        <div><button type="button" disabled={currentPage===1} aria-label="Previous reviews page"
          onClick={() => setPage(currentPage-1)}><ChevronLeft size={17}/></button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage===pageCount} aria-label="Next reviews page"
            onClick={() => setPage(currentPage+1)}><ChevronRight size={17}/></button></div>
      </div>
    </Panel>

    <div className="rw-bottom">
      <Panel title="Selected review" className="rw-detail" aside={<StatusBadge state={summary.status}/>}>
        <div className="rw-issue-heading"><FileCheck2 size={21} aria-hidden="true"/>
          <strong>{review.issueKey}</strong></div>
        <p className="rw-issue-summary">{review.summary}</p>
        <div className="rw-coverage-label"><span>Mandatory requirement coverage</span>
          <strong>{summary.covered}/{summary.mandatory}</strong></div>
        <CoverageBar covered={summary.covered} total={summary.mandatory}/>
        <div className="rw-requirements">
          {summary.rows.map(row => <div className="rw-requirement" key={row.id}>
            <FileText size={16} aria-hidden="true"/><div><strong>{row.id} · v{row.version}</strong>
              <span>{row.title}</span></div><StatusBadge state={row.state}/>
          </div>)}
          {!summary.rows.length && <p className="muted">No requirements recorded yet.</p>}
        </div>
        <div className="rw-detail-actions">
          <button type="button" className="primary" onClick={() => onNavigate('Requirements')}>Requirements <ArrowRight size={15}/></button>
          <button type="button" onClick={() => onNavigate('Evidence')}>Evidence <ArrowRight size={15}/></button>
        </div>
      </Panel>

      <div className="rw-side">
        <Panel title="Latest decision" className="rw-decision">
          {decision ? <>
            <div className="rw-decision-header"><StatusBadge state={decision.type}/>
              {summary.status === 'revalidation' && <span className="rw-revalidation-flag">Historical approval · revalidate</span>}</div>
            <dl>
              <div><dt>Recorded by</dt><dd title={decision.actor}>{actorLabel(decision.actor,actorNames)}</dd></div>
              <div><dt>When</dt><dd>{formatDate(decision.createdAt)}</dd></div>
              <div><dt>Mandatory checks approved</dt><dd>{decision.type === 'approved' ? decision.snapshotCount : 'Not applicable'}</dd></div>
            </dl>
            {decision.note && <p className="rw-decision-note">{decision.note}</p>}
          </> : <div className="rw-empty"><Clock3 size={24}/><strong>No decision recorded</strong>
            <span>Approvals and rejections will appear here after an explicit decision.</span></div>}
          <button type="button" className="rw-link rw-history-link"
            onClick={() => onNavigate('History')}>View full audit trail <ArrowRight size={14}/></button>
        </Panel>
        <Panel title="Change impact" className="rw-impact">
          <div className="rw-impact-grid">
            <div><strong>{summary.blockers.length}</strong><span>Mandatory checks needing evidence</span></div>
            <div><strong>{impact.outdatedEvidence}</strong><span>Historical evidence records</span></div>
            <div><strong>{impact.approvalsToRevalidate}</strong><span>Approvals to revisit</span></div>
          </div>
          <p>{impact.approvalsToRevalidate
            ? 'This review requires an explicit new approval, even when current evidence passes.'
            : impact.outdatedEvidence ? 'Older evidence is retained for audit, without counting toward current coverage.'
            : 'No pending version-related impact was found in the selected review.'}</p>
        </Panel>
      </div>
    </div>

    <Panel title="Recent activity" className="rw-activity" aside={<button type="button" className="rw-link"
      onClick={() => onNavigate('History')}>View all events</button>}>
      {events.length ? <ol>{events.map((event:AuditEvent) => <li key={event.id}>
        <span className="rw-timeline-dot"><History size={14}/></span>
        <div><strong>{event.description}</strong>
          <small title={event.actor}>{actorLabel(event.actor,actorNames)} · {formatDate(event.createdAt)}</small></div>
      </li>)}</ol> : <p className="muted">No events recorded yet.</p>}
    </Panel>
  </div>;
}
