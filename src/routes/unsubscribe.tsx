import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: 'Unsubscribe — BloxSmith' },
      { name: 'description', content: 'Manage your BloxSmith email preferences.' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'already' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const t = url.searchParams.get('token')
    if (!t) {
      setState({ kind: 'invalid', message: 'Missing unsubscribe token.' })
      return
    }
    setToken(t)
    ;(async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (!res.ok) {
          setState({ kind: 'invalid', message: data?.error ?? 'Invalid or expired link.' })
          return
        }
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setState({ kind: 'already' })
          return
        }
        setState({ kind: 'ready' })
      } catch {
        setState({ kind: 'error', message: 'Could not reach the server.' })
      }
    })()
  }, [])

  async function confirm() {
    if (!token) return
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ kind: 'error', message: data?.error ?? 'Unsubscribe failed.' })
        return
      }
      if (data.success === false && data.reason === 'already_unsubscribed') {
        setState({ kind: 'already' })
      } else {
        setState({ kind: 'done' })
      }
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/60 p-7 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground">Email preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">BloxSmith email notifications</p>

        <div className="mt-6 text-sm leading-relaxed text-foreground/90">
          {state.kind === 'loading' && <p>Checking your link…</p>}
          {state.kind === 'invalid' && <p className="text-destructive">{state.message}</p>}
          {state.kind === 'error' && <p className="text-destructive">{state.message}</p>}
          {state.kind === 'already' && (
            <p>You're already unsubscribed. You won't receive any more emails from us.</p>
          )}
          {state.kind === 'done' && (
            <p>You've been unsubscribed. We won't email this address again.</p>
          )}
          {(state.kind === 'ready' || state.kind === 'submitting') && (
            <>
              <p>Click below to stop receiving emails from BloxSmith at this address.</p>
              <button
                type="button"
                onClick={confirm}
                disabled={state.kind === 'submitting'}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {state.kind === 'submitting' ? 'Unsubscribing…' : 'Confirm unsubscribe'}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
