import { ExternalLink } from 'lucide-react';
import { Panel, StatusBadge } from '../../shared/components/ui';
import type { ReviewData } from '../../shared/types/review';

export function EvidencePage({ review }: { review: ReviewData }) {
  return <Panel title="Evidence records" aside={<span>{review.evidence.length} records</span>}>
    <div className="table-wrap"><table><thead><tr>
      <th>Evidence</th><th>Requirement</th><th>Result</th><th>Applicability</th><th>Reference</th>
    </tr></thead><tbody>{review.evidence.map(evidence => {
      const requirement = review.requirements.find(row => row.id === evidence.requirementId);
      return <tr key={evidence.id}>
        <td><b className="link">{evidence.id}</b><div>{evidence.title}</div></td>
        <td>{evidence.requirementId} · v{evidence.version}</td>
        <td><StatusBadge state={evidence.result === 'passed' ? 'satisfied' : 'failed'}/></td>
        <td><StatusBadge state={requirement?.version === evidence.version ? 'satisfied' : 'stale'}/></td>
        <td>{evidence.url ? <a href={evidence.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={12}/></a> : <span className="muted">No link</span>}</td>
      </tr>;
    })}</tbody></table></div>
  </Panel>;
}
