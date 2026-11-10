import {
  ArrowRight, ArrowUpRight, Check, CheckCircle2, FileCheck2,
  Fingerprint, GitCompareArrows, LockKeyhole, RefreshCw,
  ShieldCheck, Sparkles,
} from 'lucide-react';
import './login.css';

interface LoginPageProps {
  onEnterDemo: () => void;
}

/**
 * Local preview entry screen only. Forge relies on Atlassian's existing Jira
 * session, and never asks the user for Atlassian credentials in our UI.
 */
export function LoginPage({ onEnterDemo }: LoginPageProps) {
  return (
    <main className="sp-login" data-testid="scopeproof-login-preview">
      <header className="sp-login-topbar">
        <div className="sp-login-brand" aria-label="Scopeproof home">
          <span className="sp-login-brand-mark"><ShieldCheck size={23} strokeWidth={2.1} /></span>
          <span>scopeproof<span className="sp-login-brand-period">.</span></span>
        </div>
        <div className="sp-login-topbar-right">
          <span className="sp-login-topline"><span className="sp-login-online" /> Built for Jira teams</span>
          <a href="https://github.com/topassky3/scopeproof" target="_blank" rel="noopener noreferrer">
            View project <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="sp-login-main">
        <section className="sp-login-intro" aria-labelledby="sp-login-story-title">
          <div className="sp-login-orbit sp-login-orbit-one" aria-hidden="true" />
          <div className="sp-login-orbit sp-login-orbit-two" aria-hidden="true" />
          <div className="sp-login-intro-inner">
            <span className="sp-login-kicker"><Sparkles size={14} /> EVIDENCE-AWARE DELIVERY</span>
            <h1 id="sp-login-story-title">Make every<br />approval <em>count.</em></h1>
            <p>Requirements change. Your evidence should keep up. Keep every Jira approval traceable, current, and ready to defend.</p>

            <div className="sp-login-showcase" aria-label="Illustrative revalidation workflow">
              <div className="sp-login-showcase-top">
                <div className="sp-login-showcase-label"><span className="sp-login-mini-mark"><FileCheck2 size={16}/></span><span>Review health <small>ILLUSTRATIVE EXAMPLE</small></span></div>
                <span className="sp-login-live-pill"><span />Change detected</span>
              </div>
              <div className="sp-login-showcase-issue">
                <span>ACO-142 <span className="sp-login-issue-separator">/</span> Authentication</span>
                <strong>SSO requires mandatory MFA</strong>
              </div>
              <div className="sp-login-showcase-versions">
                <div className="sp-login-version-old"><span>REQUIREMENT · V1</span><b>SSO sign-in</b><small><CheckCircle2 size={13}/> Approved</small></div>
                <span className="sp-login-version-arrow"><ArrowRight size={18}/></span>
                <div className="sp-login-version-new"><span>REQUIREMENT · V2</span><b>SSO + MFA</b><small><RefreshCw size={13}/> Recheck needed</small></div>
              </div>
              <div className="sp-login-showcase-result">
                <span className="sp-login-result-icon"><GitCompareArrows size={19}/></span>
                <div><strong>Revalidation required</strong><span>EV-101 is linked to an older version.</span></div>
                <span className="sp-login-result-arrow"><ArrowUpRight size={16}/></span>
              </div>
            </div>

            <div className="sp-login-value-row">
              <span><Check size={15}/> Version-aware evidence</span>
              <span><Check size={15}/> Auditable decisions</span>
            </div>
          </div>
        </section>

        <section className="sp-login-access" aria-labelledby="sp-login-welcome-title">
          <div className="sp-login-access-inner">
            <div className="sp-login-access-icon"><Fingerprint size={27}/></div>
            <div className="sp-login-eyebrow">YOUR WORKSPACE, VERIFIED</div>
            <h2 id="sp-login-welcome-title">Welcome to<br /><span>Scopeproof.</span></h2>
            <p className="sp-login-access-desc">Sign in to review evidence, manage requirements, and track approval decisions inside Jira.</p>

            <div className="sp-login-access-options">
              <button className="sp-login-atlassian-button" type="button" disabled aria-describedby="sp-login-atlassian-note">
                <span className="sp-login-atlassian-icon">A</span>
                Continue with Atlassian
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <p id="sp-login-atlassian-note" className="sp-login-availability"><LockKeyhole size={14}/> Enabled through your Jira session after installation.</p>

              <div className="sp-login-divider"><span>LOCAL PREVIEW</span></div>
              <button className="sp-login-demo-button" type="button" onClick={onEnterDemo}>
                Explore interactive demo <ArrowRight size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="sp-login-privacy"><ShieldCheck size={17} aria-hidden="true"/><span>No Jira credentials required here. The local demo uses sample data only.</span></div>
          </div>
          <div className="sp-login-access-footer"><span>Evidence you can trust.</span><span><CheckCircle2 size={14}/> Built with security in mind</span></div>
        </section>
      </div>
      <footer className="sp-login-bottom"><span>Scopeproof · An independent Jira app concept</span><span>Local UI preview — authentication not implemented</span></footer>
    </main>
  );
}
