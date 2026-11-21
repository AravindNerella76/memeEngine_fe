import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Gate from './auth/Gate.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { BusyProvider, ConfirmProvider, OnlineProvider, ToastProvider } from './ui';
import { pageForPath, preloadPage } from './app/routes';
import './fonts';
import './index.css';

// Start downloading this page's code right now, in parallel with the sign-in check, instead of after it
preloadPage(pageForPath(window.location.pathname));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ThemeProvider>
        <OnlineProvider>
        <ConfirmProvider>
          <BusyProvider>
            <AuthProvider>
              <Gate />
            </AuthProvider>
          </BusyProvider>
        </ConfirmProvider>
        </OnlineProvider>
        </ThemeProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Offline-ready app shell: after the first visit the studio itself opens even without a connection (and says so
// clearly instead of the browser's "no internet" page). Only in the production build, and it never touches /api.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let off = false;
  try {
    off = localStorage.getItem('meme_engine_offline_shell') === 'off'; // set to "off" in the console to turn it off
  } catch {
    /* storage unavailable: default on */
  }
  window.addEventListener('load', () => {
    if (off) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    else navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
