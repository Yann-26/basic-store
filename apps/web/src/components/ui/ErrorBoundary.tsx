import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Last line of defence: show a branded recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] render error', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating elsewhere clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="eyebrow">Oups</p>
        <h1 className="font-display text-3xl font-semibold text-white">Cette page n'a pas pu s'afficher</h1>
        <p className="max-w-md text-sm text-gray-400">Une nouvelle version du site est peut-être disponible. Rechargez la page pour continuer.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-gold-gradient px-8 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-primary-black hover:brightness-110"
        >
          Recharger
        </button>
      </div>
    )
  }
}
