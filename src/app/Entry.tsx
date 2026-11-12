import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { App } from './App';
import { LoginPage } from '../features/auth/LoginPage';
import './standalone-auth.css';

export type LocalSession = {
  authenticated: boolean;
  username: string | null;
  signupEnabled: boolean;
  csrfToken: string;
};

const standalone = import.meta.env.DEV || import.meta.env.VITE_STANDALONE_AUTH === 'true';

function replacePath(next: string) {
  if (window.location.pathname !== next) window.history.replaceState({}, '', next);
}

async function readSession(): Promise<LocalSession> {
  const response = await fetch('/api/local/auth/session/', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo conectar con Django. Inicia el servidor en el puerto 8000.');
  return response.json() as Promise<LocalSession>;
}

export function Entry() {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [leaving, setLeaving] = useState(false);

  function navigate(next: '/login' | '/dashboard') {
    window.history.pushState({}, '', next);
    setPath(next);
  }

  async function refresh() {
    setChecking(true);
    setError('');
    try {
      const current = await readSession();
      setSession(current);
      const destination = current.authenticated ? '/dashboard' : '/login';
      replacePath(destination);
      setPath(destination);
    } catch (exc) {
      setSession(null);
      setError(exc instanceof Error ? exc.message : 'No se pudo comprobar la sesión.');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!standalone) return;
    void refresh();
    const onBack = () => { void refresh(); };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  async function logout() {
    if (!session || leaving) return;
    setLeaving(true);
    setError('');
    try {
      const response = await fetch('/api/local/auth/logout/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': session.csrfToken },
        body: '{}',
      });
      if (!response.ok) throw new Error('No fue posible cerrar la sesión.');
      setSession(await response.json() as LocalSession);
      navigate('/login');
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'No se pudo cerrar la sesión.');
    } finally {
      setLeaving(false);
    }
  }

  // The Jira Forge installation keeps its separate Atlassian-authenticated flow.
  if (!standalone) return <App />;

  if (checking) return <main className="sp-auth-loading" role="status"><ShieldCheck size={34}/><p>Comprobando sesión...</p></main>;
  if (error && !session) return <main className="sp-auth-loading" role="alert">
    <ShieldCheck size={34}/>
    <h1>Inicia Django</h1>
    <p>{error}</p>
    <button type="button" onClick={() => void refresh()}>Reintentar conexión</button>
  </main>;
  if (!session) return null;

  if (!session.authenticated || path !== '/dashboard') {
    return <LoginPage csrfToken={session.csrfToken} signupEnabled={session.signupEnabled}
      onAuthenticated={next => { setSession(next); navigate('/dashboard'); }}/>;
  }

  return <div className="sp-standalone-shell">
    <App
      localUsername={session.username ?? undefined}
      csrfToken={session.csrfToken}
      onLogout={() => void logout()}
      loggingOut={leaving}
      sessionError={error}
    />
  </div>;
}
