import React, { useEffect, useRef, useState } from 'react';
import { Plus, AlertTriangle, CheckCircle2, ArrowRight, X, Download, Save, Inbox } from 'lucide-react';
import { applyCommand, exampleReview, summarize } from '../domain.js';
import { AppShell, PageHeader } from '../shared/layout/AppShell';
import type { PageId } from '../shared/config/navigation';
import { OverviewPage } from '../features/overview/OverviewPage';
import { ReviewsPage } from '../features/reviews/ReviewsPage';
import { LocalReviewsPage } from '../features/reviews/LocalReviewsPage';
import { RequirementsPage } from '../features/requirements/RequirementsPage';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { HistoryPage } from '../features/history/HistoryPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// The local preview is explicitly sample data; the installed Forge app talks to Jira + Forge KVS.
const preview = import.meta.env.DEV;
const previewKey = (username?: string) => `scopeproof-preview:${username ?? 'anonymous'}`;
const projectDemo = (username?: string)=> {
  try { const raw = localStorage.getItem(previewKey(username)); return raw ? JSON.parse(raw) : exampleReview(); }
  catch { return exampleReview(); }
};
export function App({ localUsername, csrfToken, onLogout, loggingOut, sessionError }: {
  localUsername?: string;
  csrfToken?: string;
  onLogout?: () => void;
  loggingOut?: boolean;
  sessionError?: string;
} = {}){
  const [active,setActive]=useState<PageId>('Overview');
  const sessionReviews = Boolean(localUsername && csrfToken) && active === 'Reviews';
  const issueInputRef = useRef<HTMLInputElement>(null);
  const [issueKey,setIssueKey]=useState(preview?'ACO-142':'');
  const [inputKey,setInputKey]=useState(preview?'ACO-142':'');
  const [projectKey,setProjectKey]=useState(preview?'ACO':'');
  const [review,setReview]=useState<any>(preview?projectDemo(localUsername):null);
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
  useEffect(()=>{if(preview && review)localStorage.setItem(previewKey(localUsername),JSON.stringify(review));},[review,localUsername]);
  useEffect(()=>{ if(preview){setList(review?[{issueKey:review.issueKey,summary:review.summary,status:summary.status,covered:summary.covered,mandatory:summary.mandatory}]:[]);return;}
    if(!projectKey)return;
    (async()=>{try{const {invoke}=await import('@forge/bridge');const rows:any=await invoke('listReviews',{projectKey});setList(rows??[]);}catch{/* Browsing an inaccessible project yields no rows. */}})();
  },[projectKey,review]);

  async function fetchReview(key:string){
    const clean=key.trim().toUpperCase(); if(!clean){setError('Enter a Jira issue key first.');return;}
    setError('');setBusy(true);
    try{ if(preview){setIssueKey(clean);setReview(projectDemo(localUsername));}
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
  return <>
    <AppShell active={active} onNavigate={setActive} projectKey={projectKey} preview={preview}
      sessionUser={localUsername} onLogout={onLogout} loggingOut={loggingOut} sessionError={sessionError}>
      <PageHeader active={active} projectKey={projectKey} actions={<>{review && active==='Requirements'&&<button className="primary" onClick={()=>open('requirement')}><Plus size={17}/> New requirement</button>}{review && active==='Evidence'&&<button className="primary" onClick={()=>open('evidence',summary.rows[0]?.id??'')} disabled={!summary.rows.length}><Plus size={17}/> Add evidence</button>}{review && active==='Reports'&&<button className="primary" onClick={exportReport}><Download size={17}/> Export JSON</button>}</>} />
      {!sessionReviews && preview && <div className="preview-banner">Local preview · sample data only. Jira access and Forge persistence become active after deployment.</div>}
      {error&&<div role="alert" className="error"><AlertTriangle size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
      {notice&&<div role="status" className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
      {!sessionReviews && <div className="lookup"><label htmlFor="issue-input">Jira issue</label><input id="issue-input" ref={issueInputRef} value={inputKey} onChange={e=>setInputKey(e.target.value.toUpperCase())} placeholder="e.g. ACO-142"/><button onClick={()=>fetchReview(inputKey)} disabled={busy}>Open review <ArrowRight size={16}/></button>{review&&<span className="lookup-current">{review.issueKey} · {review.summary}</span>}</div>}
      {sessionReviews ? <LocalReviewsPage csrfToken={csrfToken!}/> : !review ? <div className="empty"><Inbox size={40}/><h2>Open a Jira issue to begin</h2><p>Use an issue you can access in this Jira project.</p></div> : <>
        {active === 'Overview' && <OverviewPage review={review} summary={summary} list={list} onNavigate={setActive} onSelectIssue={fetchReview}
          onNewReview={() => { issueInputRef.current?.focus(); issueInputRef.current?.select(); }}
          onAddEvidence={(id) => open('evidence', id)} />}
        {active === 'Reviews' && <ReviewsPage review={review} summary={summary} list={list} onNavigate={setActive} onSelectIssue={fetchReview}/>}
        {active === 'Requirements' && <RequirementsPage summary={summary} openEditor={open}/>}
        {active === 'Evidence' && <EvidencePage review={review}/>}
        {active === 'History' && <HistoryPage review={review}/>}
        {active === 'Reports' && <ReportsPage review={review} summary={summary}/>}
        {active === 'Settings' && <SettingsPage preview={preview}/>}
        {['Overview','Reviews','Requirements'].includes(active) && <div className="panel approval">
          <div><h2>Review decision</h2><p>{summary.blockers.length ? `${summary.blockers.length} mandatory requirements still need valid evidence.` : 'All mandatory requirements have current passing evidence.'}</p></div>
          <div className="inline-actions"><button type="button" onClick={() => open('reject')}>Reject with reason</button>
            <button type="button" className="primary" disabled={busy || summary.blockers.length > 0 || summary.status === 'approved'} onClick={() => change('approve',{note:'Verified current evidence'})}><CheckCircle2 size={16}/> Approve review</button>
          </div>
        </div>}
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
