import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.'
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-shell">
          <section className="auth-card" role="alert">
            <p className="eyebrow">BRIGHT MIND</p>
            <h1>Something interrupted your session.</h1>
            <p className="lead">
              Please reload or return to the home view. Your saved progress remains safe.
            </p>
            <p className="error" style={{ wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
            <button
              type="button"
              className="primary"
              style={{ marginTop: '1.25rem' }}
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Try again
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
