import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import './user-menu.css';

export interface UserMenuProps {
  username: string;
  onLogout: () => void;
  loggingOut?: boolean;
  error?: string;
}

/** The account menu belongs to Scopeproof's local preview header, not Jira chrome in Forge. */
export function UserMenu({ username, onLogout, loggingOut = false, error = '' }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const initials = username.trim().slice(0, 2).toUpperCase() || 'SP';

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function onEscape(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      toggle.current?.focus();
    }
  }

  return (
    <div className="sp-account-menu" ref={container} onKeyDown={onEscape}>
      <button ref={toggle} className="sp-account-trigger" type="button"
        aria-label={`Abrir menú de usuario: ${username}`}
        aria-expanded={open} aria-controls="sp-account-panel"
        onClick={() => setOpen(current => !current)}>
        <span className="sp-account-avatar" aria-hidden="true">{initials}</span>
        <ChevronDown className="sp-account-caret" size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="sp-account-panel" id="sp-account-panel" role="group" aria-label="Opciones de cuenta">
          <div className="sp-account-panel-heading">
            <span className="sp-account-avatar sp-account-avatar-large" aria-hidden="true">{initials}</span>
            <div className="sp-account-identity">
              <span className="sp-account-caption">Cuenta de Scopeproof</span>
              <strong title={username}>{username}</strong>
            </div>
          </div>
          <div className="sp-account-session"><ShieldCheck size={15} aria-hidden="true" /> Sesión iniciada</div>
          <div className="sp-account-panel-divider" aria-hidden="true" />
          {error && <div className="sp-account-error" role="alert">{error}</div>}
          <button className="sp-account-logout" type="button"
            disabled={loggingOut}
            onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={17} aria-hidden="true" />
            {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
