/**
 * Error state for every app (Phase 6): instead of a blank page, a message with
 * Reload and Reset demo. Reset demo restores the seed data in all apps.
 */
import { AlertTriangle } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import i18n from '@shared/i18n'
import { useDemoStore } from '@shared/store'

interface Props {
  children: ReactNode
  resetKey?: string
}
interface State {
  error?: Error
  key?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { key: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Moving to another page clears the error
    return props.resetKey !== state.key ? { key: props.resetKey, error: undefined } : null
  }

  render() {
    if (!this.state.error) return this.props.children
    const t = i18n.t.bind(i18n)
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <AlertTriangle className="size-10 text-status-warning" aria-hidden />
        <h1 className="text-page-title">{t('app.errorTitle')}</h1>
        <p className="max-w-md text-muted-foreground">{t('app.errorBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
            {t('app.reload')}
          </button>
          <button
            type="button"
            onClick={() => {
              useDemoStore.getState().resetDemo()
              this.setState({ error: undefined })
            }}
            className="rounded-md border bg-background px-4 py-2 font-medium"
          >
            {t('app.resetDemo')}
          </button>
          <a href="/" className="rounded-md px-4 py-2 font-medium text-primary hover:underline">
            {t('header.launcher')}
          </a>
        </div>
      </div>
    )
  }
}
