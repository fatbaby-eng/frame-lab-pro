import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; stack: string }

/**
 * Last line of defence. Without a boundary a render error unmounts the
 * whole tree and the page goes black with no message (the body is dark), so
 * the visitor sees a frozen overlay. This keeps the error on screen, offers a
 * reload that keeps the autosave, and a start-over that clears it.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: (error.stack || '') + '\n' + (info.componentStack || '') });
    console.error('[framelab] render error', error, info.componentStack);
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const details = `Frame Lab ${error.name}: ${error.message}\n${stack}`;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0a0a0f', color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24, zIndex: 99999,
      }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8 }}>Frame Lab stopped</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>Something broke while drawing the editor.</h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cbd5e1', margin: '0 0 16px' }}>
            Your project is autosaved up to the last change. Reload to pick it back up, or start over with a clean slate if it keeps happening.
          </p>
          <pre style={{
            fontSize: 11, lineHeight: 1.5, background: '#111118', border: '1px solid #27272f', borderRadius: 8,
            padding: 12, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f87171', margin: '0 0 16px',
          }}>{error.name}: {error.message}</pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => location.reload()} style={btn('#6366f1')}>Reload</button>
            <button onClick={() => { try { localStorage.removeItem('framelab-autosave-v3'); } catch { /* ignore */ } location.reload(); }} style={btn('#3f3f46')}>Start over</button>
            <button onClick={() => { void navigator.clipboard?.writeText(details); }} style={btn('#3f3f46')}>Copy details</button>
          </div>
        </div>
      </div>
    );
  }
}

function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' };
}
