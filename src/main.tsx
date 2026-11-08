import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, AlertTriangle, CheckCircle2, RefreshCw, Clock3, ClipboardCheck, Layers3, ArrowRight, X, Download,
 ExternalLink, Save, GitCompare, Inbox } from 'lucide-react';
import { applyCommand, exampleReview, summarize } from './domain.js';
import { AppShell, PageHeader } from './components/AppShell';
import { CoverageBar, Panel, StatCard, StatusBadge } from './components/ui';
import type { PageId } from './config/navigation';
import './styles.css';
import './styles/design-system.css';

// The local preview is explicitly sample data; the installed Forge app talks to Jira + Forge KVS.
const preview = import.meta.env.DEV;
const date = (v:string) => v ? new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
const projectDemo = ()=> {
  try { const raw = localStorage.getItem('scopeproof-preview'); return raw ? JSON.parse(raw) : exampleReview(); }
  catch { return exampleReview(); }
};
function App(){
  const [active,setActive]=useState<PageId>('Overview');
  const [issueKey,setIssueKey]=useState(preview?'ACO-142':'');
  const [inputKey,setInputKey]=useState(preview?'ACO-142':'');
  const [projectKey,setProjectKey]=useState(preview?'ACO':'');
  const [review,setReview]=useState<any>(preview?projectDemo():null);
  const [list,setList]=useState<any[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [modal,setModal]=useState<'requirement'|'version'|'evidence'|'reject'|null>(null);
  const [target,setTarget]=useState('');
  const [title,setTitle]=useState('');
  const [link,setLink]=useState('');
  const [result,setResult]=useState('passed');
  const [note,setNote]=useState('');
  const [mandatory,setMandatory]=useState(true);
  const summary:any=review?summarize(review):null;

  useEffect(()=>{ if (preview) return;
    (async()=>{try { const {view}=await import('@forge/bridge');const c:any=await view.getContext();
      const issue=c?.extension?.issue?.key; const project=c?.extension?.project?.key;
      if(project)setProjectKey(project);
      if(issue){setIssueKey(issue);setInputKey(issue);await fetchReview(issue);}
    }catch(e:any){setError(e?.message ?? 'Could not load Jira context');}})();
  },[]);
  useEffect(()=>{if(preview && review)localStorage.setItem('scopeproof-preview',JSON.stringify(review));},[review]);
  useEffect(()=>{ if(preview){setList(review?[{issueKey:review.issueKey,summary:review.summary,status:summary.status,covered:summary.covered,mandatory:summary.mandatory}]:[]);return;}
    if(!projectKey)return;
    (async()=>{try{const {invoke}=await import('@forge/bridge');const rows:any=await invoke('listReviews',{projectKey});setList(rows??[]);}catch{/* Browsing an inaccessible project yields no rows. */}})();
  },[projectKey,review]);

  async function fetchReview(key:string){
    const clean=key.trim().toUpperCase(); if(!clean){setError('Enter a Jira issue key first.');return;}
    setError('');setBusy(true);
    try{ if(preview){setIssueKey(clean);setReview(projectDemo());}
      else{const {invoke}=await import('@forge/bridge');const data:any=await invoke('getReview',{issueKey:clean});setIssueKey(clean);setInputKey(clean);setReview(data.review);}
      setNotice('Review loaded.');
    }catch(e:any){setError(e?.message??'Issue not accessible');}finally{setBusy(false);}
  }
  async function change(type:string,props:Record<string,any>={}){
    if(!review)return false;
    setBusy(true);setError('');setNotice('');
    try {const command={type,expectedRevision:review.revision,...props};let updated:any;
      if(preview)updated=applyCommand(review,command,'local-preview');
      else {const {invoke}=await import('@forge/bridge');const response:any=await invoke('command',{issueKey:review.issueKey,command});updated=response.review;}
      setReview(updated);setNotice('Saved successfully.');return true;
    }catch(e:any){setError(e?.message??'Unable to save. Please reload.');return false;}
    finally{setBusy(false);}
  }
  function open(mode:'requirement'|'version'|'evidence'|'reject',id=''){
    setModal(mode);setTarget(id);setTitle('');setLink('');setNote('');setResult('passed');setMandatory(true);setError('');
  }
  async function submit(e:React.FormEvent){e.preventDefault();if(!review)return;let ok=false;
    if(modal==='requirement')ok=await change('addRequirement',{title,mandatory});
    if(modal==='version')ok=await change('publishVersion',{requirementId:target,title});
    if(modal==='evidence')ok=await change('addEvidence',{requirementId:target,title,url:link,result});
    if(modal==='reject')ok=await change('reject',{note});
    if(ok)setModal(null);
  }
  function exportReport(){if(!review)return;const data={generatedAt:new Date().toISOString(),review,coverage:summarize(review)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`scopeproof-${review.issueKey}.json`;a.click();URL.revokeObjectURL(url);
  }
  const count=(key:string)=>list.filter(x=>x.status===key).length;
  return <>
    <AppShell active={active} onNavigate={setActive} projectKey={projectKey} preview={preview}>
      <PageHeader active={active} projectKey={projectKey} actions={<>{review && active==='Requirements'&&<button className="primary" onClick={()=>open('requirement')}><Plus size={17}/> New requirement</button>}{review && active==='Evidence'&&<button className="primary" onClick={()=>open('evidence',summary.rows[0]?.id??'')} disabled={!summary.rows.length}><Plus size={17}/> Add evidence</button>}{review && active==='Reports'&&<button className="primary" onClick={exportReport}><Download size={17}/> Export JSON</button>}</>} />
      {preview&&<div className="preview-banner">Local preview · sample data only. Jira access and Forge persistence become active after deployment.</div>}
      {error&&<div role="alert" className="error"><AlertTriangle size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
      {notice&&<div role="status" className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
      <div className="lookup"><label htmlFor="issue-input">Jira issue</label><input id="issue-input" value={inputKey} onChange={e=>setInputKey(e.target.value.toUpperCase())} placeholder="e.g. ACO-142"/><button onClick={()=>fetchReview(inputKey)} disabled={busy}>Open review <ArrowRight size={16}/></button>{review&&<span className="lookup-current">{review.issueKey} · {review.summary}</span>}</div>
      {!review ? <div className="empty"><Inbox size={40}/><h2>Open a Jira issue to begin</h2><p>Use an issue you can access in this Jira project.</p></div> : <>
        {(active==='Overview'||active==='Reviews')&&<>
          <div className="metrics"><StatCard value={list.length||1} label="Reviews" icon={ClipboardCheck}/><StatCard value={count('approved')} label="Approved" icon={CheckCircle2}/><StatCard value={count('revalidation')} label="Revalidation" icon={RefreshCw} tone="bad"/><StatCard value={count('in-review')+count('pending')+count('ready')} label="Not finalized" icon={Clock3}/></div>
          {summary.status==='revalidation'&&<button className="attention" onClick={()=>setActive('Requirements')}><AlertTriangle size={20}/><strong>{review.issueKey}</strong><span>Prior approval requires revalidation</span><StatusBadge state="revalidation"/><ArrowRight size={18}/></button>}
          <div className="panel"><div className="panel-head"><h2>Issue reviews</h2><span>{list.length||1} found</span></div>
            <div className="table-wrap"><table><thead><tr><th>Issue</th><th>Summary</th><th>Review status</th><th>Coverage</th><th></th></tr></thead><tbody>{(list.length?list:[{issueKey:review.issueKey,summary:review.summary,status:summary.status,covered:summary.covered,mandatory:summary.mandatory}]).map((r,i)=><tr key={r.issueKey} className={i===0?'row-selected':''}><td className="link">{r.issueKey}</td><td>{r.summary}</td><td><StatusBadge state={r.status}/></td><td><CoverageBar covered={r.covered} total={r.mandatory}/></td><td><button className="icon-btn" aria-label={`Open ${r.issueKey}`} onClick={()=>fetchReview(r.issueKey)}><ArrowRight size={17}/></button></td></tr>)}</tbody></table></div></div>
          <div className="split"><div className="panel"><div className="panel-head"><h2>Selected review</h2><StatusBadge state={summary.status}/></div><h3>{review.issueKey} · {review.summary}</h3><div className="coverage-large"><CoverageBar covered={summary.covered} total={summary.mandatory}/></div><div className="stack">{summary.rows.map((r:any)=><div className="stack-line" key={r.id}><span><b>{r.id}</b> <small>v{r.version}</small> {r.title}</span><StatusBadge state={r.state}/></div>)}</div><div className="footer-actions"><button className="primary" onClick={()=>setActive('Requirements')}>Open requirements <ArrowRight size={15}/></button><button onClick={()=>setActive('History')}>View history</button></div></div>
            <div className="panel"><div className="panel-head"><h2>Change impact</h2><GitCompare size={20}/></div><div className="impact-flow"><span>Requirement</span><ArrowRight/><span>Evidence</span><ArrowRight/><span>Approval</span></div><div className="impact-stat"><strong>{summary.blockers.length}</strong><span>mandatory checks need attention</span></div><p className="muted">Previous approvals remain in the history even when requirements change.</p></div></div>
        </>}
        {active==='Requirements'&&<div className="panel"><div className="panel-head"><h2>Requirements</h2><span>{summary.rows.length} requirements</span></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Requirement</th><th>Version</th><th>Status</th><th>Actions</th></tr></thead><tbody>{summary.rows.map((r:any)=><tr key={r.id}><td className="link">{r.id}</td><td><b>{r.title}</b><div className="subtle">{r.mandatory?'Mandatory':'Optional'}</div></td><td><span className="version">v{r.version}</span></td><td><StatusBadge state={r.state}/></td><td><div className="inline-actions"><button onClick={()=>open('version',r.id)}>New version</button><button onClick={()=>open('evidence',r.id)}>Add evidence</button></div></td></tr>)}</tbody></table></div>{!summary.rows.length&&<p className="muted">No requirements yet. Add your first mandatory requirement.</p>}</div>}
        {active==='Evidence'&&<div className="panel"><div className="panel-head"><h2>Evidence records</h2><span>{review.evidence.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Evidence</th><th>Requirement</th><th>Result</th><th>Applicability</th><th>Reference</th></tr></thead><tbody>{review.evidence.map((e:any)=>{const r=review.requirements.find((r:any)=>r.id===e.requirementId);return <tr key={e.id}><td><b className="link">{e.id}</b><div>{e.title}</div></td><td>{e.requirementId} · v{e.version}</td><td><StatusBadge state={e.result==='passed'?'satisfied':'failed'}/></td><td><StatusBadge state={r?.version===e.version?'satisfied':'stale'}/></td><td>{e.url?<a href={e.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={12}/></a>:<span className="muted">No link</span>}</td></tr>})}</tbody></table></div></div>}
        {active==='History'&&<Panel title="Timeline" aside={<span>{review.events.length} events</span>}><div className="timeline">{[...review.events].reverse().map((e:any)=><div key={e.id} className="event"><span className="event-dot"/><div><b>{e.description}</b><small>{e.actor} · {date(e.createdAt)}</small></div></div>)}</div></Panel>}
        {active==='Reports'&&<div className="panel"><div className="panel-head"><h2>Verification report · {review.issueKey}</h2><StatusBadge state={summary.status}/></div><div className="metrics"><StatCard value={summary.mandatory} label="Mandatory" icon={Layers3}/><StatCard value={summary.covered} label="Satisfied" icon={CheckCircle2}/><StatCard value={summary.blockers.length} label="Blockers" icon={AlertTriangle}/></div><h3>Requirement coverage</h3>{summary.rows.map((r:any)=><div className="stack-line" key={r.id}><span>{r.id} v{r.version} · {r.title}</span><StatusBadge state={r.state}/></div>)}<p className="muted">The export includes requirement versions, evidence, decisions, and the audit log. PDF export is a later milestone.</p></div>}
        {active==='Settings'&&<div className="panel"><div className="panel-head"><h2>Review policy</h2></div><div className="setting-line"><span>Mandatory evidence coverage</span><b>100%</b></div><div className="setting-line"><span>Auto-revalidate changed requirements</span><StatusBadge state="satisfied"/></div><div className="setting-line"><span>Data source</span><b>{preview?'Local preview':'Forge KVS + Jira'}</b></div><p className="muted">Role management and notifications are planned for a later milestone. Jira permissions are checked for issue access.</p></div>}
        {['Overview','Reviews','Requirements'].includes(active)&&<div className="panel approval"><div><h2>Review decision</h2><p>{summary.blockers.length?`${summary.blockers.length} mandatory requirements still need valid evidence.`:'All mandatory requirements have current passing evidence.'}</p></div><div className="inline-actions"><button onClick={()=>open('reject')}>Reject with reason</button><button className="primary" disabled={busy||summary.blockers.length>0||summary.status==='approved'} onClick={()=>change('approve',{note:'Verified current evidence'})}><CheckCircle2 size={16}/> Approve review</button></div></div>}
      </>}
    </AppShell>
    {modal&&<div className="overlay" role="presentation"><form className="modal" onSubmit={submit} aria-label="Scopeproof editor"><div className="modal-head"><h2>{modal==='requirement'?'Add requirement':modal==='version'?'Publish new version':modal==='evidence'?'Add evidence':'Reject review'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={()=>setModal(null)}><X size={20}/></button></div>
      {target&&<p className="muted">Target: {target}{modal==='evidence'&&review?` v${review.requirements.find((r:any)=>r.id===target)?.version??''}`:''}</p>}
      {modal!=='reject'&&<label className="field">{modal==='evidence'?'Evidence title':'Requirement description'}<input autoFocus required minLength={modal==='evidence'?3:5} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder={modal==='version'?'Describe the new requirement...':'Enter a clear, verifiable description'}/></label>}
      {modal==='requirement'&&<label className="check"><input type="checkbox" checked={mandatory} onChange={e=>setMandatory(e.target.checked)}/>Mandatory requirement</label>}
      {modal==='evidence'&&<><label className="field">Test result<select value={result} onChange={e=>setResult(e.target.value)}><option value="passed">Passed</option><option value="failed">Failed</option></select></label><label className="field">Evidence HTTPS URL (optional)<input type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..."/></label></>}
      {modal==='reject'&&<label className="field">Rejection reason<textarea autoFocus required minLength={5} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} /></label>}
      {modal==='version'&&<div className="warning"><AlertTriangle size={18}/> Publishing a new version can require revalidation of an existing approval.</div>}
      {error&&<div className="error">{error}</div>}
      <div className="footer-actions"><button type="button" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}><Save size={16}/> Save</button></div>
    </form></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
