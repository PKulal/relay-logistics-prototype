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

interface SessionState {
  sessions: Partial<Record<AppKey, AppSession>>
  language: Language
  login: (app: AppKey, userId: Id) => void
  logout: (app: AppKey) => void
  setLanguage: (language: Language) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      sessions: {},
      language: 'en',
      login: (app, userId) => set((s) => ({ sessions: { ...s.sessions, [app]: { userId, loggedInAt: Date.now() } } })),
      logout: (app) =>
        set((s) => {
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
      },
    },
  ),
)

/** The logged-in user id for an app in this tab, if any. */
export const useSessionUser = (app: AppKey) => useSession((s) => s.sessions[app]?.userId)
