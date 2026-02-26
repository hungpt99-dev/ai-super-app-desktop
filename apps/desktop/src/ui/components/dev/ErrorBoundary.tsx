/**
 * ErrorBoundary.tsx
 * 
 * Global React error boundary that catches JavaScript errors in component trees.
 * Prevents the entire app from crashing when a single component fails.
 * Shows a user-friendly error message with option to reload.
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react'

interface IProps {
  children: ReactNode
  fallback?: ReactNode
}

interface IState {
  hasError: boolean
  error: Error | null
}

/**
 * Global error boundary for the entire application.
 * Catches any unhandled errors and displays a friendly recovery UI.
 */
export class ErrorBoundary extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): IState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console in development
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // In production, you could send to error reporting service here
    // e.g., sentry.captureException(error, { extra: errorInfo })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex h-screen w-full items-center justify-center bg-[var(--color-bg)] p-4">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            </div>
            
            <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
              Something went wrong
            </h1>
            
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              An unexpected error occurred. The app will attempt to recover when you reload.
              {this.state.error !== null && (
                <span className="mt-2 block font-mono text-xs text-[var(--color-text-muted)]">
                  {this.state.error.message}
                </span>
              )}
            </p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to easily wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  return function WrappedComponent(props: P): ReactNode {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
