import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../ui';
import { resetFailedPages } from './routes';

// What browsers say when a page's code file is gone, which happens after the studio is updated while a tab is open
const STALE_CODE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i;

/**
 * Catches a crash inside one page so the sidebar, the engine status and the rest of the app stay usable.
 * Leaving the page (or pressing Try again) resets it. `resetKey` is the current path.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('A page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = STALE_CODE.test(String(error?.message || error));
    return (
      <div className="page-enter mx-auto max-w-xl pt-6" role="alert">
        <EmptyState
          tone="bad"
          icon={stale ? RefreshCw : AlertTriangle}
          title={stale ? 'This page did not load' : 'Something broke on this page'}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button
                variant="dark"
                onClick={() => {
                  resetFailedPages(); // a page whose code failed to download is fetched again
                  this.setState({ error: null });
                }}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Try again
              </Button>
              {stale ? (
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Reload the studio
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => (window.location.href = '/')} leftIcon={<Home className="h-4 w-4" />}>
                  Back to start
                </Button>
              )}
            </div>
          }
        >
          {stale
            ? 'The files for this page could not be downloaded: the connection may have dropped, or a newer version of the studio was installed while this tab was open. Try again, and reload the studio if it keeps failing. Nothing you saved is lost.'
            : 'The rest of the studio is fine. Your saved memes and settings are safe. If it keeps happening, tell whoever maintains the studio what you were doing.'}
        </EmptyState>
        {!stale && (
          <details className="mt-3 rounded-md border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
            <summary className="cursor-pointer font-semibold text-ink-3">Technical details</summary>
            <pre className="thin-scrollbar mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px]">{String(error?.stack || error?.message || error)}</pre>
          </details>
        )}
      </div>
    );
  }
}
