import { StatusBadge, Panel } from '../../shared/components/ui';
import type { OpenEditor, ReviewSummary } from '../../shared/types/review';

export function RequirementsPage({ summary, openEditor }: { summary: ReviewSummary; openEditor: OpenEditor }) {
  return <Panel title="Requirements" aside={<span>{summary.rows.length} requirements</span>}>
    <div className="table-wrap"><table><thead><tr>
      <th>ID</th><th>Requirement</th><th>Version</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>{summary.rows.map(row => <tr key={row.id}>
      <td className="link">{row.id}</td>
      <td><b>{row.title}</b><div className="subtle">{row.mandatory ? 'Mandatory' : 'Optional'}</div></td>
      <td><span className="version">v{row.version}</span></td>
      <td><StatusBadge state={row.state}/></td>
      <td><div className="inline-actions">
        <button type="button" onClick={() => openEditor('version', row.id)}>New version</button>
        <button type="button" onClick={() => openEditor('evidence', row.id)}>Add evidence</button>
      </div></td>
    </tr>)}</tbody></table></div>
    {!summary.rows.length && <p className="muted">No requirements yet. Add your first mandatory requirement.</p>}
  </Panel>;
}
