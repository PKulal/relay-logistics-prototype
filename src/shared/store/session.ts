/**
 * Per-tab session: who is logged in to which app, and the UI language.
 * Kept in sessionStorage (one tab = one browser session) and NOT synced, so one
 * tab can be Priya in the Customer Portal while another is Ravi in the Partner App.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import i18n, { type Language } from '@shared/i18n'
import type { AppKey, Id } from '@shared/types'

export interface AppSession {
  userId: Id
  /** Real time of login — UI bookkeeping only, not demo time. */
  loggedInAt: number
}

/** CP-01 / PP-01 "Remember me": the login survives closing the tab (this device only). */
const REMEMBER_KEY = 'logisco-remember'
const readRemembered = (): Partial<Record<AppKey, Id>> => {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? '{}') as Partial<Record<AppKey, Id>>
  } catch {
    return {}
  }
}
const writeRemembered = (r: Partial<Record<AppKey, Id>>) => {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(r))
  } catch {
    /* storage blocked: remember for this tab only */
  }
}

interface SessionState {
  sessions: Partial<Record<AppKey, AppSession>>
  language: Language
  login: (app: AppKey, userId: Id, remember?: boolean) => void
  logout: (app: AppKey) => void
  setLanguage: (language: Language) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      sessions: {},
      language: 'en',
      login: (app, userId, remember) => {
        if (remember) writeRemembered({ ...readRemembered(), [app]: userId })
        set((s) => ({ sessions: { ...s.sessions, [app]: { userId, loggedInAt: Date.now() } } }))
      },
      logout: (app) =>
        set((s) => {
          const r = readRemembered()
          if (r[app]) {
            delete r[app]
            writeRemembered(r)
          }
          const sessions = { ...s.sessions }
          delete sessions[app]
          return { sessions }
        }),
      setLanguage: (language) => {
        void i18n.changeLanguage(language)
        set({ language })
      },
    }),
    {
      name: 'logisco-session',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.language) void i18n.changeLanguage(state.language)
        // A remembered login fills in an app this tab isn't logged in to
        if (state) {
          const r = readRemembered()
          for (const [app, userId] of Object.entries(r) as [AppKey, Id][]) if (!state.sessions[app] && userId) state.sessions = { ...state.sessions, [app]: { userId, loggedInAt: Date.now() } }
        }
      },
    },
  ),
)

/** The logged-in user id for an app in this tab, if any. */
export const useSessionUser = (app: AppKey) => useSession((s) => s.sessions[app]?.userId)
