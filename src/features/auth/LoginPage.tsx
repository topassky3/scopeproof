import { useState, type FormEvent } from 'react';
import type { LocalSession } from '../../app/Entry';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, FileCheck2,
  GitCompareArrows, LockKeyhole, RefreshCw, ShieldCheck,
  Sparkles, Layers3, Eye, EyeOff, LogIn, UserPlus,
} from 'lucide-react';
import './login.css';
import './login-visual.css';
import './login-form.css';

interface LoginPageProps {
  csrfToken: string;
  signupEnabled: boolean;
  onAuthenticated: (session: LocalSession) => void;
}

type AuthMode = 'login' | 'register';

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos.',
  WEAK_PASSWORD: 'Elige una contraseña de al menos 10 caracteres que no sea común.',
  USERNAME_UNAVAILABLE: 'Ese usuario ya está registrado.',
  USERNAME_FORMAT: 'Usa entre 3 y 30 letras, números o guiones bajos.',
  SIGNUP_DISABLED: 'El registro está deshabilitado.',
  INVALID_REQUEST: 'Comprueba los datos enviados.',
};

export function LoginPage({ csrfToken, signupEnabled, onAuthenticated }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const response = await fetch(`/api/local/auth/${endpoint}/`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({})) as Partial<LocalSession> & { error?: string };
      if (!response.ok) {
        throw new Error(messages[data.error ?? ''] ?? (response.status === 403
          ? 'La sesión de seguridad expiró. Actualiza la página e inténtalo nuevamente.'
          : 'No se pudo completar el acceso.'));
      }
      if (!data.authenticated || !data.username || !data.csrfToken) throw new Error('Respuesta de sesión incompleta.');
      setPassword('');
      setConfirmation('');
      onAuthenticated(data as LocalSession);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'No se pudo conectar con Django.');
    } finally {
      setBusy(false);
    }
  }
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
            <span className="sp-login-access-logo"><ShieldCheck size={31}/></span>
            <span className="sp-login-access-eyebrow">TU ESPACIO DE TRABAJO</span>
            <h2 id="sp-login-welcome-title">{mode === 'login' ? <>Bienvenido<br/><span>de nuevo.</span></> : <>Crea tu<br/><span>cuenta.</span></>}</h2>
            <p className="sp-login-access-desc">{mode === 'login'
              ? 'Inicia sesión para abrir tu dashboard.'
              : 'Un usuario y una contraseña para acceder a Scopeproof.'}</p>

            {signupEnabled && <div className="sp-auth-tabs" role="group" aria-label="Tipo de acceso">
              <button type="button" className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'}
                onClick={() => { setMode('login'); setError(''); }}>Iniciar sesión</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'}
                onClick={() => { setMode('register'); setError(''); }}>Crear cuenta</button>
            </div>}

            <form className="sp-auth-form" onSubmit={handleSubmit}>
              <label htmlFor="scopeproof-username">Usuario</label>
              <input id="scopeproof-username" type="text" autoComplete="username" placeholder="Tu nombre de usuario"
                minLength={3} maxLength={30} required value={username}
                onChange={event => setUsername(event.target.value)} disabled={busy} />
              <label htmlFor="scopeproof-password">Contraseña</label>
              <div className="sp-auth-password">
                <input id="scopeproof-password" type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 10 : undefined} maxLength={1024} required
                  placeholder="••••••••••" value={password}
                  onChange={event => setPassword(event.target.value)} disabled={busy} />
                <button type="button" onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword} disabled={busy}>
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              {mode === 'register' && <>
                <label htmlFor="scopeproof-confirmation">Confirmar contraseña</label>
                <input id="scopeproof-confirmation" type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password" minLength={10} maxLength={1024} required
                  placeholder="Repite tu contraseña" value={confirmation}
                  onChange={event => setConfirmation(event.target.value)} disabled={busy} />
                <small className="sp-auth-help">Usa al menos 10 caracteres y evita contraseñas comunes.</small>
              </>}
              {error && <p className="sp-auth-error" role="alert">{error}</p>}
              <button className="sp-login-demo-button sp-auth-submit" type="submit" disabled={busy}>
                {mode === 'login' ? <LogIn size={19}/> : <UserPlus size={19}/>}
                {busy ? 'Validando...' : mode === 'login' ? 'Entrar al dashboard' : 'Crear cuenta y entrar'}
                <ArrowRight size={19} aria-hidden="true"/>
              </button>
            </form>
            <p className="sp-auth-local-note"><ShieldCheck size={15}/> Sesión de Django. Acceso a Jira mediante Forge.</p>
          </div>
        </section>
      </div>
      <footer className="sp-login-bottom"><span>Scopeproof · Evidence-aware delivery</span><span>Django user access</span></footer>
    </main>
  );
}
