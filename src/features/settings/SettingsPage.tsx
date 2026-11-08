import { Panel, StatusBadge } from '../../shared/components/ui';

export function SettingsPage({ preview }: { preview: boolean }) {
  return <Panel title="Review policy">
    <div className="setting-line"><span>Mandatory evidence coverage</span><b>100%</b></div>
    <div className="setting-line"><span>Auto-revalidate changed requirements</span><StatusBadge state="satisfied"/></div>
    <div className="setting-line"><span>Data source</span><b>{preview ? 'Local preview' : 'Forge KVS + Jira'}</b></div>
    <p className="muted">Role management and notifications are planned for a later milestone. Jira permissions are checked for issue access.</p>
  </Panel>;
}
