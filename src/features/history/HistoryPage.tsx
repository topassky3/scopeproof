import { useMemo, useState } from 'react';
import { History, Layers3, FileCheck, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Panel, StatCard } from '../../shared/components/ui';
import type { ReviewData } from '../../shared/types/review';
import { actorLabel } from '../../shared/actors/actor-names.mjs';
import { historyRows, historyMetrics, filterHistory, eventDetail } from './history-model.mjs';
import type { EventDetail } from './history-model.mjs';
import './history.css';

const formatDate = (value: string) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', {
    year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short',
  }) : 'Date not recorded or invalid';
};
function Detail({detail}:{detail:EventDetail}) {
  if(detail.kind==='unavailable') return <p className="muted">Historical detail could not be uniquely matched to a stored record. The original event is preserved.</p>;
  if(detail.kind==='requirement') return <div className="hist-diff">
    {detail.version>1 && <div><b>Previous version · v{detail.version-1}</b><p>{detail.previousTitle ?? 'Historical description unavailable'}</p></div>}
    <div><b>{detail.requirementId} · v{detail.version}</b><p>{detail.title}</p></div>
  </div>;
  if(detail.kind==='evidence') return <><p><b>{detail.evidenceId}</b> · {detail.requirementId} v{detail.version} · {detail.result}</p><p>{detail.title || 'Title not recorded'}</p><p className="muted">Recorded result for that historical version, not a claim of current coverage.</p></>;
  if(detail.kind==='decision') return <><h3>Recorded decision note</h3><p>{detail.note || 'No note recorded'}</p><h3>Evidence snapshot at decision</h3>
    {detail.snapshot.length ? <ul>{detail.snapshot.map((item,i)=><li key={i}>{item.requirementId || 'Unknown requirement'} · v{item.version ?? '?'} · {item.evidenceId || 'Unknown evidence'}</li>)}</ul> : <p className="muted">No evidence snapshot recorded.</p>}</>;
  return <p className="muted">Original audit event. No additional linked record is available.</p>;
}
export function HistoryPage({ review, actorNames = {} }: { review: ReviewData; actorNames?: Record<string, string> }) {
  return <HistoryWorkspace key={review.issueKey} review={review} actorNames={actorNames}/>;
}
function HistoryWorkspace({review,actorNames}:{review:ReviewData;actorNames:Record<string,string>}) {
  const rows=useMemo(()=>historyRows(review),[review]);
  const metrics=historyMetrics(rows);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [selectedKey,setSelectedKey]=useState('');
  const [limit,setLimit]=useState(20);
  const matches=filterHistory(rows,query,category,actorNames);
  const visible=matches.slice(0,limit);
  const selected=visible.find(row=>row.key===selectedKey) ?? visible[0];
  return <div className="hist-page">
    <div className="metrics hist-metrics">
      <StatCard value={metrics.total} label="Audit events" icon={History}/>
      <StatCard value={metrics.requirements} label="Requirement events" icon={Layers3}/>
      <StatCard value={metrics.evidence} label="Evidence events" icon={FileCheck}/>
      <StatCard value={metrics.decisions} label="Decisions" icon={ClipboardCheck}/>
    </div>
    <Panel title="Audit scope" aside={<span>{review.issueKey} · Revision {review.revision}</span>}>
      <p className="hist-context"><AlertTriangle size={18} aria-hidden="true"/> {metrics.revalidation} recorded revalidation events. Historical events are not the current approval status.</p>
    </Panel>
    <div className="hist-workspace">
      <Panel title="Timeline" aside={<span>{matches.length} of {metrics.total} events</span>}>
        <div className="hist-toolbar">
          <label>Search events<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}} placeholder="Description or recorded by"/></label>
          <label>Event type<select value={category} onChange={e=>{setCategory(e.target.value);setLimit(20);}}>
            <option value="all">All events</option><option value="requirements">Requirements</option><option value="evidence">Evidence</option>
            <option value="decisions">Decisions</option><option value="revalidation">Revalidation</option><option value="other">Other</option>
          </select></label>
        </div>
        <div className="timeline">{visible.map(row=>{
          const event=row.event;
          return <div className="event" key={row.key}><span className="event-dot"/>
            <button type="button" className={'hist-event'+(selected?.key===row.key?' hist-selected':'')} aria-pressed={selected?.key===row.key} onClick={()=>setSelectedKey(row.key)}>
              <span className="hist-category">{row.label}</span><b>{event.description}</b>
              <small>{actorLabel(event.actor, actorNames)} · {formatDate(event.createdAt)}</small>
            </button>
          </div>;
        })}</div>
        {!visible.length&&<p className="muted">{rows.length?'No events match these filters.':'No audit events recorded yet.'}</p>}
        {visible.length<matches.length&&<button type="button" onClick={()=>setLimit(n=>n+20)}>Show more events ({visible.length}/{matches.length})</button>}
      </Panel>
      <Panel title="Event details" className="hist-details">
        {selected ? <><span className="hist-category">{selected.label}</span><h3>{selected.event.description}</h3>
          <p className="muted">{actorLabel(selected.event.actor,actorNames)} · {formatDate(selected.event.createdAt)}</p>
          <Detail detail={eventDetail(review,selected.event)}/></> : <p className="muted">Select an event to inspect the stored historical details.</p>}
      </Panel>
    </div>
  </div>;
}
