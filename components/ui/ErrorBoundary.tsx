'use client';
import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.name ?? 'Panel'}]`, error.message, info.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '12px',
          background: 'var(--bg-panel, #050a05)',
          border: '1px solid #5e1a1a',
          borderRadius: '3px',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: '#ff5252',
          minHeight: 40,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            ⚠ {this.props.name ?? 'Panel'} Error
          </div>
          <div style={{ color: 'var(--text-muted, #607d8b)', fontSize: '9px' }}>
            {this.state.error?.message ?? 'Something went wrong'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '8px',
              background: 'transparent',
              border: '1px solid #5e1a1a',
              color: '#ff5252',
              padding: '2px 8px',
              fontSize: '9px',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              borderRadius: '2px',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
