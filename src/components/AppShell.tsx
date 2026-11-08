import type { ReactNode } from 'react';
import {
  Bell, ChevronDown, CircleHelp, ExternalLink, Menu, Search, ShieldCheck, X,
} from 'lucide-react';
import { useState } from 'react';
import { PAGES, pageDefinition, type PageId } from '../config/navigation';

interface AppShellProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
  projectKey: string;
  preview: boolean;
  children: ReactNode;
}

/** Local-only preview chrome. Inside Forge, Jira already provides its own header. */
function PreviewJiraHeader({ projectKey }: { projectKey: string }) {
  return (
    <header className="demo-jira-header" aria-label="Jira preview navigation">
      <div className="demo-jira-brand" aria-label="Jira preview"><span className="demo-jira-symbol">◆</span> Jira</div>
      <div className="demo-jira-separator" />
      <div className="demo-jira-project"><span className="project-icon">{(projectKey || 'AC').slice(0, 2)}</span><span>Atlas Commerce</span><ChevronDown size={15} /></div>
      <div className="demo-jira-links" aria-hidden="true"><span>Your work</span><strong>Projects</strong><span>Filters</span><span>Dashboards</span><span>Apps</span></div>
      <div className="demo-jira-utilities" aria-hidden="true"><Search size={19}/><CircleHelp size={19}/><Bell size={19}/><span className="avatar">ML</span></div>
    </header>
  );
}

function Sidebar({ active, onNavigate, onDone }: {
  active: PageId;
  onNavigate: (page: PageId) => void;
  onDone: () => void;
}) {
  return (
    <aside className="sp-sidebar">
      <div className="sp-sidebar-heading"><ShieldCheck size={36} strokeWidth={2.15} /><div><strong>Scopeproof</strong><span>Evidence-aware delivery</span></div></div>
      <nav className="sp-navigation" aria-label="Scopeproof navigation">
        {PAGES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`sp-nav-item ${active === id ? 'is-active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => { onNavigate(id); onDone(); }}>
            <Icon size={19} strokeWidth={2} /> <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sp-sidebar-note" aria-hidden="true"><ShieldCheck size={28}/><span>Keep approvals valid as requirements evolve.</span></div>
    </aside>
  );
}

export function AppShell({ active, onNavigate, projectKey, preview, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app sp-app">
      {preview && <PreviewJiraHeader projectKey={projectKey} />}
      <div className="sp-shell">
        <button type="button" className="sp-mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>} Menu</button>
        <div className={`sp-sidebar-wrap ${mobileOpen ? 'is-open' : ''}`}><Sidebar active={active} onNavigate={onNavigate} onDone={() => setMobileOpen(false)} /></div>
        <main className="sp-content" id="main-content">
          {children}
          <footer className="sp-footer"><span>Scopeproof · Evidence-aware delivery</span><span>Atlassian Forge app <ExternalLink size={12}/></span></footer>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ active, projectKey, actions }: {
  active: PageId;
  projectKey: string;
  actions?: ReactNode;
}) {
  const page = pageDefinition(active);
  const Icon = page.icon;
  return (
    <>
      <div className="sp-breadcrumb" aria-label="Breadcrumb"><span>{projectKey || 'Jira project'}</span><span>/</span><span>Scopeproof</span><span>/</span><strong>{page.label}</strong></div>
      <div className="sp-page-header">
        <div className="sp-page-title"><span className="sp-page-icon"><Icon size={30}/></span><div><h1>{active === 'Overview' ? 'Project Overview' : page.label}</h1><p>{page.description}</p></div></div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}
