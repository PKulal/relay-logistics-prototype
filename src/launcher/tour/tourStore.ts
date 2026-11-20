/** Guided tour position (Phase 6). Per browser tab, like the session; survives reloads so the tour can pause and resume. */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface TourState {
  active: boolean
  paused: boolean
  step: number
  /** Steps the reviewer ran with "Do it for me" or confirmed as done */
  done: number[]
  start: () => void
  go: (step: number) => void
  markDone: (step: number) => void
  pause: (paused: boolean) => void
  exit: () => void
}

export const useTour = create<TourState>()(
  persist(
    (set) => ({
      active: false,
      paused: false,
      step: 0,
      done: [],
      start: () => set({ active: true, paused: false, step: 0, done: [] }),
      go: (step) => set({ step, paused: false }),
      markDone: (step) => set((s) => ({ done: s.done.includes(step) ? s.done : [...s.done, step] })),
      pause: (paused) => set({ paused }),
      exit: () => set({ active: false, paused: false, step: 0, done: [] }),
    }),
    { name: 'logisco-tour', storage: createJSONStorage(() => sessionStorage) },
  ),
)
