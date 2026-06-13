import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-petro-bg flex items-center justify-center p-6">
          <div className="bg-petro-card border border-petro-border rounded-lg p-8 max-w-md w-full flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold text-text-warm uppercase tracking-wide">
              Something went wrong loading this view
            </p>
            {this.state.error && (
              <pre className="text-xs font-mono text-text-faint bg-petro-bg border border-petro-border rounded px-3 py-2 w-full overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 text-xs font-bold uppercase tracking-wide bg-petro-border text-text-warm rounded hover:bg-petro-border/80 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
