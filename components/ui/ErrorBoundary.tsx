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
          padding: '12px 16px',
          background: 'var(--surface)',
          border: 'var(--bw) solid var(--down)',
          borderRadius: 'var(--radius)',
          fontSize: '10px',
          color: 'var(--down)',
          minHeight: 40,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            ⚠ {this.props.name ?? 'Panel'} Error
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
            {this.state.error?.message ?? 'Something went wrong'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '8px',
              background: 'transparent',
              border: 'var(--bw) solid var(--down)',
              color: 'var(--down)',
              padding: '2px 8px',
              fontSize: '9px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: 'var(--radius-inner)',
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
