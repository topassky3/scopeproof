import {
  ArrowRight, ArrowUpRight, CheckCircle2, FileCheck2,
  GitCompareArrows, LockKeyhole, RefreshCw, ShieldCheck,
  Sparkles, Play, Layers3,
} from 'lucide-react';
import './login.css';
import './login-visual.css';

interface LoginPageProps {
  onEnterDemo: () => void;
}

/**
 * Welcome screen for local development only. A Forge app runs within an
 * authenticated Jira session; this view never handles Atlassian credentials.
 */
export function LoginPage({ onEnterDemo }: LoginPageProps) {
  return (
    <main className="sp-login" data-testid="scopeproof-login-preview">
      <header className="sp-login-topbar">
        <div className="sp-login-brand" aria-label="Scopeproof">
          <span className="sp-login-brand-mark"><ShieldCheck size={22} strokeWidth={2.2}/></span>
          <span>scopeproof<span className="sp-login-brand-period">.</span></span>
        </div>
        <a className="sp-login-github" href="https://github.com/topassky3/scopeproof"
          target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={16} aria-hidden="true"/></a>
      </header>

      <div className="sp-login-main">
        <section className="sp-login-intro" aria-labelledby="sp-login-story-title">
          <div className="sp-login-glow" aria-hidden="true"/>
          <div className="sp-login-intro-inner">
            <span className="sp-login-kicker"><Sparkles size={14}/> BUILT FOR JIRA TEAMS</span>
            <h1 id="sp-login-story-title">Ship with<br/><em>proof.</em></h1>
            <p>Requirements change. Your approvals stay accountable.</p>

            <div className="sp-login-visual" aria-label="Sample workflow: an approved requirement changes, evidence becomes outdated, and revalidation is required">
              <div className="sp-login-visual-header">
                <div className="sp-login-visual-app"><span className="sp-login-visual-app-icon"><Layers3 size={16}/></span><b>Review flow</b></div>
                <span className="sp-login-example">SAMPLE</span>
              </div>

              <div className="sp-login-nodes">
                <div className="sp-login-node is-approved">
                  <div className="sp-login-node-icon"><FileCheck2 size={23}/></div>
                  <small>REQUIREMENT</small>
                  <b>Version 1</b>
                  <span><CheckCircle2 size={14}/> Approved</span>
                </div>
                <div className="sp-login-node-connector" aria-hidden="true"><ArrowRight size={25}/></div>
                <div className="sp-login-node is-updated">
                  <div className="sp-login-node-icon"><GitCompareArrows size={23}/></div>
                  <small>UPDATED</small>
                  <b>Version 2</b>
                  <span><RefreshCw size={14}/> Changed</span>
                </div>
              </div>

              <div className="sp-login-flow-line" aria-hidden="true"><span/></div>
              <div className="sp-login-alert">
                <span className="sp-login-alert-icon"><RefreshCw size={22}/></span>
                <div><b>Revalidation required</b><small>Previous evidence is outdated</small></div>
                <span className="sp-login-alert-status" aria-hidden="true">!</span>
              </div>
            </div>
            <div className="sp-login-mini-caption"><CheckCircle2 size={15}/> Every decision. Fully traceable.</div>
          </div>
        </section>

        <section className="sp-login-access" aria-labelledby="sp-login-welcome-title">
          <div className="sp-login-access-inner">
            <span className="sp-login-access-logo"><ShieldCheck size={32}/></span>
            <span className="sp-login-access-eyebrow">WELCOME TO SCOPEPROOF</span>
            <h2 id="sp-login-welcome-title">Evidence.<br/><span>Under control.</span></h2>
            <p className="sp-login-access-desc">See how your team keeps approvals up to date.</p>

            <button className="sp-login-demo-button" type="button" onClick={onEnterDemo}>
              <Play size={17} fill="currentColor" aria-hidden="true"/>
              Explore interactive demo
              <ArrowRight size={19} aria-hidden="true"/>
            </button>
            <div className="sp-login-demo-hint"><span className="sp-login-hint-dot"/> Local preview · sample data only</div>

            <div className="sp-login-divider"><span>ATLASSIAN ACCESS</span></div>
            <button className="sp-login-atlassian-button" type="button" disabled aria-describedby="sp-login-atlassian-note">
              <span className="sp-login-atlassian-icon">A</span>
              Continue with Atlassian
              <LockKeyhole size={15} aria-hidden="true"/>
            </button>
            <p id="sp-login-atlassian-note" className="sp-login-availability">Available inside your Jira workspace.</p>
          </div>
          <div className="sp-login-access-bottom"><ShieldCheck size={16}/> Jira handles your sign-in securely</div>
        </section>
      </div>
      <footer className="sp-login-bottom"><span>Scopeproof · Evidence-aware delivery</span><span>Local interface preview</span></footer>
    </main>
  );
}
