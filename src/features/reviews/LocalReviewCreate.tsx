import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import './local-review-create.css';

interface Props {
  busy: boolean;
  initialIssueKey?: string;
  onCreate: (issueKey: string, summary: string) => Promise<boolean>;
  onCancel: () => void;
}

/** A local, user-owned review. It does NOT create a Jira issue. */
export function LocalReviewCreate({ busy, initialIssueKey = '', onCreate, onCancel }: Props) {
  const [issueKey, setIssueKey] = useState(initialIssueKey);
  const [summary, setSummary] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}$/.test(issueKey.trim().toUpperCase())) return;
    await onCreate(issueKey.trim().toUpperCase(), summary.trim());
  }

  return <section className="panel sp-local-create" aria-labelledby="local-create-heading">
    <div className="sp-local-create-heading">
      <div>
        <h2 id="local-create-heading">Create local review</h2>
        <p className="muted">Saved under your Django account. Not synced to Jira.</p>
      </div>
      <button type="button" aria-label="Cancel creating review" onClick={onCancel} disabled={busy}><X size={18}/></button>
    </div>
    <form onSubmit={submit} className="sp-local-create-form">
      <label className="field">Review identifier
        <input autoFocus required maxLength={80} placeholder="ACO-142" value={issueKey}
          onChange={event => setIssueKey(event.target.value.toUpperCase())}
          pattern="[A-Z][A-Z0-9_]*-[1-9][0-9]{0,8}" disabled={busy} />
      </label>
      <label className="field">Summary
        <input required minLength={5} maxLength={180}
          placeholder="Implement SSO authentication" value={summary}
          onChange={event => setSummary(event.target.value)} disabled={busy} />
      </label>
      <button className="primary" type="submit" disabled={busy || summary.trim().length < 5}>
        <Plus size={16}/> {busy ? 'Saving...' : 'Create review'}
      </button>
    </form>
  </section>;
}
