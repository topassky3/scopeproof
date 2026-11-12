import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Plus, Save, X } from 'lucide-react';
import { Panel, StatusBadge } from '../../shared/components/ui';
import { LocalReviewCreate } from './LocalReviewCreate';
import { ReviewWorkspace } from './ReviewWorkspace';
import { listLocalReviews, getLocalReview, createLocalReview, commandLocalReview } from './localReviewApi';
import type { LocalReviewResponse } from './localReviewApi';
import type { ReviewListItem } from '../../shared/types/review';
import { buildHistoryEntries } from '../history/history-model.mjs';
import './local-reviews-page.css';

type Editor = 'requirement' | 'version' | 'evidence' | 'reject';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** An independent Django session-based Reviews workspace. Never mutates the other six pages. */
export function LocalReviewsPage({ csrfToken }: { csrfToken: string }) {
  const [rows, setRows] = useState<ReviewListItem[]>([]);
  const [selected, setSelected] = useState<LocalReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [result, setResult] = useState<'passed' | 'failed'>('passed');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const review = selected?.review;
  const derived = selected?.derived;
  const events = useMemo(() => review ? buildHistoryEntries(review) : [], [review]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const records = await listLocalReviews();
        if (cancelled) return;
        setRows(records);
        if (records.length) {
          const detail = await getLocalReview(records[0].issueKey);
          if (!cancelled) setSelected(detail);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : 'Unable to load saved reviews.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function refreshList() {
    try {
      setRows(await listLocalReviews());
    } catch {
      setNotice('Saved in Django, but the review list could not be refreshed.');
    }
  }

  async function create(key: string, summary: string): Promise<boolean> {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await createLocalReview(key, summary, csrfToken);
      setSelected(response);
      setCreateOpen(false);
      setNotice('Review created and saved to your Django account.');
      await refreshList();
      return true;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Unable to create review.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function selectIssue(key: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      setSelected(await getLocalReview(key));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Unable to open review.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCommand(type: string, values: Record<string, unknown> = {}): Promise<boolean> {
    if (!review) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await commandLocalReview(review.issueKey, {
        type, expectedRevision: review.revision, ...values,
      }, csrfToken);
      setSelected(response);
      setNotice('Saved in Django.');
      await refreshList();
      return true;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Unable to save. Reload the review.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openEditor(next: Editor, requirementId = '') {
    setEditor(next); setTargetId(requirementId); setTitle('');
    setMandatory(true); setResult('passed'); setEvidenceUrl(''); setReason('');
    setError(''); setNotice('');
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let success = false;
    if (editor === 'requirement') success = await saveCommand('addRequirement', { title, mandatory });
    if (editor === 'version') success = await saveCommand('publishVersion', { title, requirementId: targetId });
    if (editor === 'evidence') success = await saveCommand('addEvidence', {
      requirementId: targetId, title, result, url: evidenceUrl,
    });
    if (editor === 'reject') success = await saveCommand('reject', { note: reason.trim() });
    if (success) setEditor(null);
  }

  function scrollTo(page: 'Requirements' | 'History') {
    document.getElementById(page === 'Requirements' ? 'local-review-requirements' : 'local-review-history')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return <div className="sp-local-reviews">
    <div className="sp-local-reviews-bar">
      <p className="muted">Saved under your Django account · Local reviews are not synced with Jira.</p>
      <button type="button" className="primary" disabled={busy} onClick={() => setCreateOpen(true)}>
        <Plus size={17}/> New review
      </button>
    </div>
    {error && <div role="alert" className="error"><AlertTriangle size={17}/>{error}
      <button aria-label="Dismiss error" type="button" onClick={() => setError('')}><X size={16}/></button></div>}
    {notice && <div role="status" className="notice"><CheckCircle2 size={17}/>{notice}</div>}
    {createOpen && <LocalReviewCreate busy={busy} onCreate={create} onCancel={() => setCreateOpen(false)}/>}
    {loading ? <p role="status" className="sp-local-reviews-wait">Loading saved reviews...</p>
      : !review || !derived ? <Panel title="Reviews">
          <div className="sp-local-reviews-empty">
            <Clock3 size={30}/>
            <h2>No reviews yet</h2>
            <p>Create your first review to track requirements, evidence and approvals.</p>
            <button type="button" className="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16}/> Create review
            </button>
          </div>
        </Panel>
        : <>
          <ReviewWorkspace review={review} summary={derived} list={rows}
            onNavigate={scrollTo} onSelectIssue={key => void selectIssue(key)}/>
          <div id="local-review-requirements" className="sp-local-reviews-anchor">
            <Panel title="Requirements" aside={<button type="button" disabled={busy}
              onClick={() => openEditor('requirement')}><Plus size={15}/> Add requirement</button>}>
              <div className="table-wrap"><table><thead><tr>
                <th>Requirement</th><th>Version</th><th>Evidence</th><th>Actions</th>
              </tr></thead><tbody>{derived.rows.map(row => <tr key={row.id}>
                <td><strong>{row.id}</strong> · {row.title}
                  <span className="subtle">{row.mandatory ? 'Mandatory' : 'Optional'}</span></td>
                <td>v{row.version}</td><td><StatusBadge state={row.state}/></td>
                <td><div className="inline-actions">
                  <button type="button" disabled={busy} onClick={() => openEditor('evidence', row.id)}>Add evidence</button>
                  <button type="button" disabled={busy} onClick={() => openEditor('version', row.id)}>New version</button>
                </div></td>
              </tr>)}</tbody></table></div>
              {derived.rows.length === 0 && <p className="muted">Add a mandatory requirement to start reviewing.</p>}
            </Panel>
          </div>
          <Panel title="Current evidence" aside={<span>{review.evidence.length} records</span>}>
            <div className="table-wrap"><table><thead><tr>
              <th>Evidence</th><th>Requirement version</th><th>Result</th>
            </tr></thead><tbody>{review.evidence.map(ev => <tr key={ev.id}>
              <td>{ev.id} · {ev.title}</td><td>{ev.requirementId} v{ev.version}</td>
              <td><StatusBadge state={ev.result === 'passed' ? 'satisfied' : 'failed'}/></td>
            </tr>)}</tbody></table></div>
            {review.evidence.length === 0 && <p className="muted">No evidence recorded yet.</p>}
          </Panel>
          <Panel title="Review decision" aside={<StatusBadge state={derived.status}/>}>
            <p>{derived.blockers.length
              ? `${derived.blockers.length} mandatory requirements need current passing evidence.`
              : derived.mandatory === 0
                ? 'Add a mandatory requirement before approval.'
                : 'All mandatory requirements have current passing evidence.'}</p>
            <div className="inline-actions">
              <button type="button" disabled={busy} onClick={() => openEditor('reject')}>Reject with reason</button>
              <button type="button" className="primary"
                disabled={busy || derived.mandatory === 0 || derived.blockers.length > 0 || derived.status === 'approved'}
                onClick={() => void saveCommand('approve', { note: 'Verified current evidence' })}>
                <CheckCircle2 size={16}/> Approve review
              </button>
            </div>
          </Panel>
          <div id="local-review-history" className="sp-local-reviews-anchor">
            <Panel title="Review history" aside={<span>{events.length} events</span>}>
              <ol className="sp-local-reviews-timeline">
                {events.map(event => <li key={event.id}>
                  <strong>{event.description}</strong>
                  {event.rejectionReason && <p>Reason: {event.rejectionReason}</p>}
                  <small>{event.actor} · {formatDate(event.createdAt)}</small>
                </li>)}
              </ol>
              {events.length === 0 && <p className="muted">No events yet.</p>}
            </Panel>
          </div>
        </>}
    {editor && review && <div className="overlay" role="presentation">
      <form className="modal" aria-label="Edit local review" onSubmit={event => void submitEditor(event)}>
        <div className="modal-head">
          <h2>{editor === 'requirement' ? 'Add requirement' : editor === 'version' ? 'Publish new version'
            : editor === 'evidence' ? 'Add evidence' : 'Reject review'}</h2>
          <button type="button" aria-label="Close editor" disabled={busy} onClick={() => setEditor(null)}>
            <X size={19}/>
          </button>
        </div>
        {targetId && <p className="muted">Requirement: {targetId}</p>}
        {editor === 'reject' ? <label className="field">Reason (required)
          <textarea autoFocus required minLength={5} maxLength={500} value={reason}
            onChange={event => setReason(event.target.value)}/></label> : <>
          <label className="field">{editor === 'evidence' ? 'Evidence title' : 'Requirement description'}
            <input autoFocus required minLength={editor === 'evidence' ? 3 : 5} maxLength={180}
              value={title} onChange={event => setTitle(event.target.value)}/></label>
          {editor === 'requirement' && <label className="check">
            <input type="checkbox" checked={mandatory} onChange={event => setMandatory(event.target.checked)}/>
            Mandatory requirement
          </label>}
          {editor === 'evidence' && <>
            <label className="field">Test result<select value={result}
              onChange={event => setResult(event.target.value as 'passed' | 'failed')}>
              <option value="passed">Passed</option><option value="failed">Failed</option>
            </select></label>
            <label className="field">Evidence URL (HTTPS, optional)
              <input type="url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)}
                placeholder="https://example.org/test"/></label>
          </>}
          {editor === 'version' && <p className="muted">A new version may require approval revalidation.</p>}
        </>}
        <div className="footer-actions">
          <button type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}><Save size={16}/> Save</button>
        </div>
      </form>
    </div>}
  </div>;
