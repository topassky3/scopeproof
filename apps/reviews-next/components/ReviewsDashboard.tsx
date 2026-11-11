'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3,
  FileCheck2, GitCompareArrows, History, RefreshCw, RotateCcw, Search, ShieldCheck,
} from 'lucide-react';
import {
  applyPreviewCommand, approvalAvailable, buildHistoryEntries, buildReviewList, canApprove, deriveReview,
  filterReviewList, makeDemoReview, reviewMetrics,
} from '../lib/review-model.mjs';
import type { ReviewData, ReviewListItem, ReviewResponse, ReviewState, ReviewSummary } from '../lib/types';

const isPreview = process.env.NEXT_PUBLIC_SCOPEPROOF_MODE !== 'forge';
const labels: Record<string, string> = {
  approved: 'Approved', revalidation: 'Revalidation required', ready: 'Ready to approve',
  'in-review': 'In review', pending: 'Pending', rejected: 'Rejected',
  satisfied: 'Satisfied', stale: 'Needs evidence', failed: 'Failed', missing: 'Missing',
};
const validIssueKey = (key: string) => /^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(key);

function Status({ state }: { state: string }) {
  const tone = ['approved', 'satisfied', 'ready'].includes(state) ? 'good'
    : ['revalidation', 'stale', 'failed', 'rejected'].includes(state) ? 'bad' : 'warn';
  return <span className={'status status-' + tone}>{labels[state] ?? state}</span>;
}

function Coverage({ covered, total }: { covered: number; total: number }) {
  const percent = total ? Math.min(100, Math.max(0, 100 * covered / total)) : 0;
  return <span className="coverage">
    <span className="coverage-track" role="progressbar"
      aria-label="Mandatory requirement coverage" aria-valuemin={0}
      aria-valuemax={total} aria-valuenow={covered}>
      <span style={{ width: percent + '%' }} />
    </span>
    <strong>{covered}/{total}</strong>
  </span>;
}

export function ReviewsDashboard() {
  const [review, setReview] = useState<ReviewData | null>(
    () => isPreview ? makeDemoReview() as ReviewData : null
  );
  const [serverSummary, setServerSummary] = useState<ReviewSummary | null>(null);
  const [index, setIndex] = useState<ReviewListItem[]>([]);
  const [issueInput, setIssueInput] = useState(isPreview ? 'ACO-142' : '');
  const [projectKey, setProjectKey] = useState(isPreview ? 'ACO' : '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const summary = useMemo(
    () => review ? (serverSummary ?? deriveReview(review) as ReviewSummary) : null,
    [review, serverSummary],
  );
  const rows = useMemo(
    () => buildReviewList(review, summary, index) as ReviewListItem[],
    [review, summary, index],
  );
  const filtered = useMemo(
    () => filterReviewList(rows, search, statusFilter) as ReviewListItem[],
    [rows, search, statusFilter],
  );
  const metrics = useMemo(() => reviewMetrics(rows), [rows]);

  // Read Jira context and data ONLY in Forge mode, after client hydration.
  useEffect(() => {
    if (isPreview) return;
    let cancelled = false;
    async function init() {
      setBusy(true);
      try {
        const { view, invoke } = await import('@forge/bridge');
        const context: any = await view.getContext();
        const issue = context?.extension?.issue?.key as string | undefined;
        const project = context?.extension?.project?.key as string | undefined;
        if (cancelled) return;
        if (project) {
          setProjectKey(project);
          const loaded = await invoke('listReviews', { projectKey: project });
          if (!cancelled) setIndex(Array.isArray(loaded) ? loaded as ReviewListItem[] : []);
        }
        if (issue) {
          const response = await invoke('getReview', { issueKey: issue }) as ReviewResponse;
          if (!cancelled) {
            setReview(response.review);
            setServerSummary(response.derived);
            setIssueInput(issue);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load Jira reviews.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, []);

  async function openIssue(key: string) {
    const normalized = key.trim().toUpperCase();
    if (!validIssueKey(normalized)) {
      setError('Enter a valid Jira issue key (example: ACO-142).');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (isPreview) {
        if (normalized !== 'ACO-142') throw new Error('Sample preview contains only ACO-142.');
        setReview(makeDemoReview() as ReviewData);
        setServerSummary(null);
      } else {
        const { invoke } = await import('@forge/bridge');
        const result = await invoke('getReview', { issueKey: normalized }) as ReviewResponse;
        setReview(result.review);
        setServerSummary(result.derived);
      }
      setIssueInput(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open review.');
    } finally {
      setBusy(false);
    }
  }

  async function sendCommand(type: 'approve' | 'reject' | 'addEvidence', payload: Record<string, unknown> = {}) {
    if (!review) return;
    if (type === 'approve' && !approvalAvailable(summary)) {
      setError(summary?.status === 'approved'
        ? 'This review is already approved. New changes must be reviewed before approving again.'
        : 'All mandatory requirements need current passing evidence before approval.');
      return;
    }
    if (type === 'reject' && rejectReason.trim().length < 5) {
      setError('Explain the rejection using at least 5 characters.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const command = { type, expectedRevision: review.revision, ...payload };
      if (isPreview) {
        const updated = applyPreviewCommand(review, command) as ReviewData;
        setReview(updated);
        setServerSummary(null);
      } else {
        const { invoke } = await import('@forge/bridge');
        const response = await invoke('command', { issueKey: review.issueKey, command }) as ReviewResponse;
        setReview(response.review);
        setServerSummary(response.derived);
      }
      if (type === 'reject') setRejectReason('');
      setNotice(type === 'approve' ? 'Review approved.' :
        type === 'reject' ? 'Review rejection recorded.' : 'Preview evidence added.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Save failed. Reload the review and try again.');
    } finally {
      setBusy(false);
    }
  }

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openIssue(issueInput);
  }
  function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendCommand('reject', { note: rejectReason.trim() });
  }

  return <div className="shell">
    <aside className="sidebar" aria-label="Scopeproof section">
      <div className="logo"><ShieldCheck size={29} aria-hidden="true" />
        <span><strong>Scopeproof</strong><small>Evidence-aware delivery</small></span>
      </div>
      <nav aria-label="Section navigation"><span className="nav-current" aria-current="page">
        <ClipboardCheck size={19} aria-hidden="true" /> Reviews
      </span></nav>
      <p className="sidebar-info">Track approvals as requirements evolve.</p>
    </aside>
    <main id="main-content" className="content">
      <div className="breadcrumb">{projectKey || 'Jira project'} / Scopeproof / <strong>Reviews</strong></div>
      <header className="page-title">
        <div><h1>Reviews</h1><p>Track, approve, and revalidate work with evidence.</p></div>
        <span className="page-icon"><FileCheck2 size={27} aria-hidden="true" /></span>
      </header>

      {isPreview && <p className="preview-banner" role="note">
        Sample preview only · No real Jira records or Forge persistence. Demo actions change local state only.
      </p>}
      {error && <div className="message message-error" role="alert"><AlertTriangle size={18} aria-hidden="true" />
        <span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="message message-success" role="status"><CheckCircle2 size={18} aria-hidden="true" />
        <span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}

      <form className="issue-lookup" onSubmit={submitIssue}>
        <label htmlFor="issue-key">Jira issue</label>
        <input id="issue-key" value={issueInput} onChange={e => setIssueInput(e.target.value.toUpperCase())}
          placeholder="ACO-142" autoComplete="off" />
        <button className="button" type="submit" disabled={busy}>Open review <ArrowRight size={16} /></button>
        {review && <span className="lookup-active">{review.issueKey} · {review.summary}</span>}
      </form>

      <div className="stats" aria-label="Review statistics">
        <div className="stat"><ClipboardCheck aria-hidden="true" /><div><strong>{metrics.reviews}</strong><span>Reviews</span></div></div>
        <div className="stat"><CheckCircle2 aria-hidden="true" /><div><strong>{metrics.approved}</strong><span>Approved</span></div></div>
        <div className="stat"><RefreshCw aria-hidden="true" /><div><strong>{metrics.revalidation}</strong><span>Revalidation</span></div></div>
        <div className="stat"><Clock3 aria-hidden="true" /><div><strong>{metrics.notFinalized}</strong><span>Not finalized</span></div></div>
      </div>

      {review && summary?.status === 'revalidation' && <div className="attention" role="status">
        <AlertTriangle size={19} aria-hidden="true" />
        <strong>{review.issueKey}</strong><span>Prior approval requires revalidation.</span>
        <Status state="revalidation" />
      </div>}

      <section className="panel" aria-labelledby="reviews-heading">
        <div className="panel-heading"><h2 id="reviews-heading">Issue reviews</h2><span>{filtered.length} found</span></div>
        <div className="filters">
          <label className="search-field"><Search size={17} aria-hidden="true" />
            <span className="sr-only">Search reviews</span>
            <input aria-label="Search reviews" placeholder="Search issue or summary" value={search}
              onChange={e => setSearch(e.target.value)} />
          </label>
          <label className="filter-field">Status
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All</option><option value="approved">Approved</option>
              <option value="revalidation">Revalidation required</option>
              <option value="ready">Ready to approve</option><option value="in-review">In review</option>
              <option value="rejected">Rejected</option><option value="pending">Pending</option>
            </select>
          </label>
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th scope="col">Issue</th><th scope="col">Summary</th>
            <th scope="col">Review status</th><th scope="col">Coverage</th><th scope="col">Action</th></tr></thead>
          <tbody>{filtered.map(item => <tr key={item.issueKey}
            className={item.issueKey === review?.issueKey ? 'selected-row' : ''}>
            <td><strong className="issue-link">{item.issueKey}</strong></td><td>{item.summary}</td>
            <td><Status state={item.status} /></td>
            <td><Coverage covered={item.covered} total={item.mandatory} /></td>
            <td><button type="button" className="action-icon"
              aria-label={'Open ' + item.issueKey} disabled={busy}
              onClick={() => void openIssue(item.issueKey)}><ArrowRight size={17} /></button></td>
          </tr>)}</tbody>
        </table></div>
        {!filtered.length && <p className="empty-row">No matching reviews in the available records.</p>}
      </section>

      {review && summary ? <>
        <div className="two-col">
          <section className="panel" aria-labelledby="selected-heading">
            <div className="panel-heading"><h2 id="selected-heading">Selected review</h2><Status state={summary.status} /></div>
            <h3>{review.issueKey} · {review.summary}</h3>
            <div className="large-coverage"><Coverage covered={summary.covered} total={summary.mandatory} /></div>
            <div id="requirements" className="requirements">
              {summary.rows.map(row => <div className="requirement" key={row.id}>
                <span><strong>{row.id}</strong><small>v{row.version}</small>{row.title}
                  {!row.mandatory && <em>Optional</em>}</span>
                <Status state={row.state}/>
              </div>)}
            </div>
            <div className="panel-links"><a href="#requirements">Open requirements <ArrowRight size={15}/></a>
              <a href="#review-history">View history <History size={15}/></a></div>
          </section>
          <section className="panel" aria-labelledby="impact-heading">
            <div className="panel-heading"><h2 id="impact-heading">Change impact</h2><GitCompareArrows size={20} /></div>
            <div className="impact-flow"><span>Requirement</span><ArrowRight size={16} /><span>Evidence</span>
              <ArrowRight size={16} /><span>Approval</span></div>
            <div className="impact-count"><strong>{summary.blockers.length}</strong>
              <span>mandatory checks need attention</span></div>
            <p className="muted">Previous approvals remain in history when a requirement changes.</p>
            {summary.blockers.length > 0 && <ul className="blocker-list">
              {summary.blockers.map(item => <li key={item.id}>{item.id}: {labels[item.state] ?? item.state}</li>)}
            </ul>}
            {isPreview && summary.rows.some(row => row.id === 'RQ-01' && row.state !== 'satisfied')
              && <button className="button demo-action" disabled={busy}
                onClick={() => void sendCommand('addEvidence', {
                  requirementId: 'RQ-01', title: 'MFA v2 manual demo test', result: 'passed',
                })}>Demo: add passed evidence for RQ-01 v2</button>}
          </section>
        </div>

        <section className="panel decision" aria-labelledby="decision-heading">
          <div><h2 id="decision-heading">Review decision</h2>
            <p>{canApprove(summary)
              ? 'All mandatory requirements have current passing evidence.'
              : summary.mandatory === 0
                ? 'At least one mandatory requirement is needed before approval.'
                : summary.blockers.length + ' mandatory requirements still need valid evidence.'}</p>
            <p className="muted">Approval is checked again by the backend when connected to Jira.</p>
            {summary.status === 'approved' && <p className="muted">The current evidence snapshot is already approved.</p>}
          </div>
          <div className="decision-controls">
            <button className="button button-primary" disabled={busy || !approvalAvailable(summary)}
              type="button" onClick={() => void sendCommand('approve')}>Approve review</button>
          </div>
          <form className="reject-form" onSubmit={submitRejection}>
            <label htmlFor="rejection-reason">Reason for rejection (required)</label>
            <div><input id="rejection-reason" minLength={5} maxLength={500}
              placeholder="Describe why the review is rejected" value={rejectReason}
              onChange={e => setRejectReason(e.target.value)} />
              <button type="submit" className="button" disabled={busy || rejectReason.trim().length < 5}>
                Reject with reason
              </button></div>
          </form>
        </section>

        <section className="panel" id="review-history" aria-labelledby="history-heading">
          <div className="panel-heading"><h2 id="history-heading">Review history</h2>
            <span>{review.events.length} events · {review.approvals.length} decisions</span></div>
          <ol className="history-list">{buildHistoryEntries(review).map(event =>
            <li key={event.id}><strong>{event.description}</strong>
              <span>{event.actor} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Date unavailable'}</span>
              {event.rejectionReason && <p className="history-reason"><strong>Rejection reason:</strong> {event.rejectionReason}</p>}
            </li>)}</ol>
        </section>
      </> : <section className="panel" role="status">
        <h2>No review selected</h2>
        <p className="muted">{busy ? 'Loading data from Jira…' : 'Choose an accessible Jira issue to review.'}</p>
      </section>}

      {isPreview && <div className="demo-reset"><button type="button" className="button"
        onClick={() => { setReview(makeDemoReview() as ReviewData); setServerSummary(null); setError(''); setNotice('Demo reset.'); setRejectReason(''); }}>
        <RotateCcw size={16} /> Reset demo
      </button></div>}
      <footer className="footer"><span>Scopeproof · Evidence-aware delivery</span>
        <span>{isPreview ? 'Local Next.js preview' : 'Atlassian Forge frontend'}</span></footer>
    </main>
  </div>;
}
