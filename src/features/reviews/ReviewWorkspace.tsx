import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, GitCompare, RefreshCw } from 'lucide-react';
import { CoverageBar, Panel, StatCard, StatusBadge } from '../../shared/components/ui';
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

interface Props {
  review: ReviewData;
  summary: ReviewSummary;
  list: ReviewListItem[];
  onNavigate: (page: 'Requirements' | 'History') => void;
  onSelectIssue: (key: string) => void;
}

/** Shared operational workspace. Overview and Reviews can evolve independently later. */
export function ReviewWorkspace({ review, summary, list, onNavigate, onSelectIssue }: Props) {
  const rows = list.length ? list : [{
    issueKey: review.issueKey, summary: review.summary, status: summary.status,
    covered: summary.covered, mandatory: summary.mandatory,
  }];
  const count = (state: string) => list.filter(item => item.status === state).length;

  return <>
    <div className="metrics">
      <StatCard value={list.length || 1} label="Reviews" icon={ClipboardCheck}/>
      <StatCard value={count('approved')} label="Approved" icon={CheckCircle2} tone="good"/>
      <StatCard value={count('revalidation')} label="Revalidation" icon={RefreshCw} tone="bad"/>
      <StatCard value={count('in-review') + count('pending') + count('ready')} label="Not finalized" icon={Clock3}/>
    </div>
    {summary.status === 'revalidation' && <button type="button" className="attention" onClick={() => onNavigate('Requirements')}>
      <AlertTriangle size={20}/><strong>{review.issueKey}</strong>
      <span>Prior approval requires revalidation</span><StatusBadge state="revalidation"/><ArrowRight size={18}/>
    </button>}
    <Panel title="Issue reviews" aside={<span>{rows.length} found</span>}>
      <div className="table-wrap"><table><thead><tr>
        <th>Issue</th><th>Summary</th><th>Review status</th><th>Coverage</th><th>Action</th>
      </tr></thead><tbody>{rows.map(row => <tr key={row.issueKey} className={row.issueKey === review.issueKey ? 'row-selected' : ''}>
        <td className="link">{row.issueKey}</td><td>{row.summary}</td>
        <td><StatusBadge state={row.status}/></td>
        <td><CoverageBar covered={row.covered} total={row.mandatory}/></td>
        <td><button type="button" className="icon-btn" aria-label={`Open ${row.issueKey}`} onClick={() => onSelectIssue(row.issueKey)}><ArrowRight size={17}/></button></td>
      </tr>)}</tbody></table></div>
    </Panel>
    <div className="split">
      <Panel title="Selected review" aside={<StatusBadge state={summary.status}/>}>
        <h3>{review.issueKey} · {review.summary}</h3>
        <div className="coverage-large"><CoverageBar covered={summary.covered} total={summary.mandatory}/></div>
        <div className="stack">{summary.rows.map(row => <div className="stack-line" key={row.id}>
          <span><b>{row.id}</b> <small>v{row.version}</small> {row.title}</span><StatusBadge state={row.state}/>
        </div>)}</div>
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
