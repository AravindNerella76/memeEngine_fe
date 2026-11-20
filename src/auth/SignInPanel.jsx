import React, { useRef, useState } from 'react';
import { KeyRound, MessageCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';
import SignInForm from './SignInForm';
import WhatsAppSignIn from './WhatsAppSignIn';
import { cn } from '../ui';

const METHOD_KEY = 'meme_engine_signin_method';
const readMethod = () => {
  try {
    return localStorage.getItem(METHOD_KEY);
  } catch {
    return null;
  }
};
const saveMethod = m => {
  try {
    localStorage.setItem(METHOD_KEY, m);
  } catch {
    /* only a convenience */
  }
};

const METHODS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'password', label: 'Password', icon: KeyRound }
];

/**
 * How to sign in: send a code from WhatsApp (offered when the server's bot is set up) or type the password. Remembers
 * the last choice on this device. Used on the sign-in page and in the "session ended" dialog.
 */
export default function SignInPanel({ compact = false }) {
  const { whatsappLogin } = useAuth();
  const [method, setMethod] = useState(() => (whatsappLogin && readMethod() !== 'password' ? 'whatsapp' : 'password'));
  const tabs = useRef([]);

  if (!whatsappLogin) return <SignInForm />;
  const choose = m => {
    setMethod(m);
    saveMethod(m);
  };
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = METHODS[(i + (e.key === 'ArrowRight' ? 1 : METHODS.length - 1)) % METHODS.length];
    choose(next.id);
    tabs.current[METHODS.indexOf(next)]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="How to sign in" className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-line-strong bg-paper-2/70 p-1">
        {METHODS.map((m, i) => {
          const active = method === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              ref={el => (tabs.current[i] = el)}
              type="button"
              role="tab"
              id={`signin-tab-${m.id}`}
              aria-selected={active}
              aria-controls={`signin-panel-${m.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(m.id)}
              onKeyDown={e => onKey(e, i)}
              className={cn(
                'flex h-10 items-center justify-center gap-2 rounded text-[13.5px] font-semibold transition-[background-color,box-shadow,color] duration-150',
                active ? 'border-2 border-ink bg-surface text-ink shadow-hard-sm' : 'border-2 border-transparent text-muted hover:bg-surface/70 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {m.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`signin-panel-${method}`} aria-labelledby={`signin-tab-${method}`} key={method} className="animate-fade-in">
        {method === 'whatsapp' ? <WhatsAppSignIn compact={compact} onUsePassword={() => choose('password')} /> : <SignInForm />}
      </div>
    </div>
  );
}
