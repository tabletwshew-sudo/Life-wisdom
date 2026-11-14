import { Component, type ReactNode } from 'react'

/** Shows a friendly screen (instead of a blank page) if something crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Family Hub crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl" aria-hidden>
          🙈
        </p>
        <h1 className="text-2xl font-extrabold">Oops, something went wrong</h1>
        <p className="max-w-sm text-ink-3">Reloading usually fixes it. Your family’s data is safe.</p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem('fh-cache')
            } catch {
              /* ignore */
            }
            location.reload()
          }}
          className="min-h-12 rounded-2xl bg-brand-500 px-6 font-semibold text-white"
        >
          Reload
        </button>
      </div>
    )
  }
}
