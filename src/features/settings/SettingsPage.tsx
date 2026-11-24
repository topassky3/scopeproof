import { Panel } from '../../shared/components/ui';
import './settings.css';

type Policy = readonly [label: string, value: string];

function PolicyRows({ rows }: { rows: readonly Policy[] }) {
  return <dl className="settings-policies">{rows.map(([label, value]) =>
    <div className="setting-line settings-policy" key={label}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>)}
  </dl>;
}

export function SettingsPage({ preview }: { preview: boolean }) {
  return <div className="settings-page">
    <Panel title="Review policy" aside={<span>Read-only</span>}>
      <p className="muted">These are current application rules, not editable preferences.</p>
      <PolicyRows rows={[
        ['Mandatory evidence coverage', '100%'],
        ['Minimum mandatory requirements for approval', '1'],
        ['Explicit approval', 'Required'],
        ['Rejection reason', 'At least 5 characters'],
      ]}/>
      <p className="muted">Coverage and approval are separate. Passing evidence alone does not create an approval.</p>
    </Panel>
    <Panel title="Evidence policy">
      <PolicyRows rows={[
        ['Evidence scope', 'Current requirement version'],
        ['Coverage source', 'Latest evidence for that version'],
        ['Evidence URL', 'Optional; HTTPS prefix if supplied'],
        ['Historical records', 'Retained'],
      ]}/>
      <p className="muted">A recorded result is not an independently verified test. Earlier evidence remains historical when a new version is published.</p>
    </Panel>
    <Panel title="Change and revalidation">
      <PolicyRows rows={[
        ['Approval snapshot validation', 'Active'],
        ['Approval after invalidation', 'Fresh explicit decision required'],
        ['Revision checking', 'Optimistic revision check'],
      ]}/>
      <p>Approval validity is evaluated against requirement versions and their latest evidence in the stored approval snapshot, with mandatory coverage required for approval.</p>
      <p className="muted">Historical revalidation events do not necessarily mean an active blocker. Atomic concurrent updates are not guaranteed.</p>
    </Panel>
    <Panel title="Security and permissions">
      {preview ? <>
        <p>Local preview uses sample review data. Jira permission checks are not active in this preview.</p>
        <p className="muted">The standalone Reviews tab may use a separate Django session; this panel describes the preview review data only.</p>
      </> : <>
        <PolicyRows rows={[
          ['Read access', 'Jira issue access as the acting user'],
          ['Write access', 'EDIT_ISSUES permission required'],
          ['Approval and rejection', 'Same issue edit permission as other review commands'],
        ]}/>
        <p className="muted">There is no separate approver role in this version.</p>
      </>}
      <h3>Declared Forge permissions</h3>
      <p className="muted">App manifest scopes; these are not a live check of your personal permissions.</p>
      <ul className="settings-scopes">
        <li><code>read:jira-work</code> - Read Jira work data</li>
        <li><code>read:jira-user</code> - Read Jira user data</li>
        <li><code>storage:app</code> - App storage</li>
      </ul>
    </Panel>
    <Panel title="Data management">
      <PolicyRows rows={[
        ['Data source', preview ? 'Local preview' : 'Forge KVS + Jira'],
        ['Review storage', preview ? 'Browser local storage' : 'Forge KVS'],
        ['Export formats', 'JSON / PDF'],
      ]}/>
      <p>Exports reflect the loaded review. JSON includes raw records and internal identifiers. PDF omits structured internal identifiers and evidence URLs, but free text may contain sensitive information.</p>
      <p className="muted">Share exports only with authorized recipients.</p>
    </Panel>
    <Panel title="Current limitations">
      <p>Separate role management and notifications are not implemented. This page does not change policies, permissions or stored reviews.</p>
      <p className="muted">Revision checks are not an atomic concurrency guarantee.</p>
    </Panel>
  </div>;
}
