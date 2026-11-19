import React from 'react';
import App from '../App';
import { useAuth } from './AuthProvider';
import LoginScreen, { Splash } from './LoginScreen';
import SignInForm from './SignInForm';
import { AdaptationProvider } from '../adapt/AdaptationProvider';
import { Dialog, StatusProvider } from '../ui';

/** A session that ended while the studio was open: it stays on screen behind this dialog, nothing is lost. */
function SessionEndedDialog() {
  return (
    <Dialog
      open
      onClose={() => {}}
      hideClose
      size="sm"
      tone="sticker"
      title="Sign in again"
      description="Your session ended, so the studio locked. Everything on screen is still here; sign in to carry on."
    >
      <SignInForm />
    </Dialog>
  );
}

/** Decides what you see: the studio when signed in (or when login is off), the sign-in page otherwise. */
export default function Gate() {
  const { status, expired } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'authed' || expired) {
    return (
      <StatusProvider>
        <AdaptationProvider>
          <App />
          {expired && <SessionEndedDialog />}
        </AdaptationProvider>
      </StatusProvider>
    );
  }
  return <LoginScreen />;
}
