import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { App } from './App';
import { LoginPage } from '../features/auth/LoginPage';

/**
 * A visual-only welcome screen for local development.
 * A Forge module is already inside an authenticated Jira session, so that
 * environment must open the real application without an extra login gate.
 */
export function Entry() {
  const [demoOpen, setDemoOpen] = useState(false);
  if (!import.meta.env.DEV) return <App />;
  if (!demoOpen) return <LoginPage onEnterDemo={() => setDemoOpen(true)} />;
  return <>
    <App />
    <button type="button" className="sp-login-preview-return" onClick={() => setDemoOpen(false)}>
      <ArrowLeft size={15} aria-hidden="true"/> Back to welcome
    </button>
  </>;
}
