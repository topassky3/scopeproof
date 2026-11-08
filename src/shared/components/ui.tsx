import type { ElementType, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';

export const STATUS_LABELS: Record<string,string> = {
  approved: 'Approved', revalidation: 'Revalidation required', ready: 'Ready to approve',
  'in-review': 'In review', pending: 'Pending', rejected: 'Rejected',
  satisfied: 'Satisfied', stale: 'Needs evidence', failed: 'Failed', missing: 'Missing',
};
export const statusTone = (state: string): 'good'|'bad'|'warn'|'info'|'muted' => ({
  approved:'good', satisfied:'good', ready:'good', revalidation:'bad', stale:'bad',
  failed:'bad', rejected:'bad', missing:'warn', 'in-review':'info', pending:'muted',
} as Record<string,'good'|'bad'|'warn'|'info'|'muted'>)[state] ?? 'muted';

export function StatusBadge({ state }: {state: string}) {
  const tone = statusTone(state);
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? RefreshCw : tone === 'warn' ? AlertTriangle : Clock3;
  return <span className={`badge badge-${tone}`}><Icon size={13} aria-hidden="true" /> {STATUS_LABELS[state] ?? state}</span>;
}

export function StatCard({value, label, icon: Icon, tone = 'info'}: {
  value:number|string; label:string; icon:ElementType; tone?:'info'|'good'|'bad'|'warn'|'muted';
}) {
  return <div className={`metric sp-stat-card sp-stat-${tone}`}>
    <span className="metric-icon"><Icon size={24}/></span>
    <div><strong>{value}</strong><span>{label}</span></div>
  </div>;
}

export function Panel({ title, aside, children, className = '' }: {
  title?: string; aside?: ReactNode; children:ReactNode; className?:string;
}) {
  return <section className={`panel ${className}`}>
    {(title || aside) && <div className="panel-head">{title ? <h2>{title}</h2> : <span/>}{aside}</div>}
    {children}
  </section>;
}

export function CoverageBar({covered, total}: {covered:number; total:number}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, covered / total * 100)) : 0;
  return <div className="coverage"><div className="progress" role="progressbar" aria-label="Requirement coverage" aria-valuemin={0} aria-valuemax={total} aria-valuenow={covered}>
    <span style={{width:`${pct}%`}} />
  </div><b>{covered}/{total}</b></div>;
}
