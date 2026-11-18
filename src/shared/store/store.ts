/**
 * The one store shared by all four apps (docs/data-model.md).
 * - Persisted to localStorage under "logisco-demo-v1".
 * - Synced across tabs with BroadcastChannel("logisco") — see sync.ts.
 * - Time comes from `demoNow`, never Date.now() (CLAUDE.md rule 4).
 * Who is logged in is per tab and lives in the session store, not here.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildSeed, DEMO_START } from '@data/seed'
import { addMinutes } from '@shared/lib/time'
import { advanceJourneys } from '@shared/sim/journey'
import type { BookingDraft, Consignee, DemoData, Id, IsoDateTime, ShipmentEvent } from '@shared/types'
import { applyEvents } from './actions'
import { bookShipment, type BookingInput } from './booking'

export const STORAGE_KEY = 'logisco-demo-v1'
/** Bump when the seed or data shape changes: saved data from an older version is replaced by a fresh seed. */
export const STORE_VERSION = 5

export interface DemoFlags {
  /** Demo toolbar: show "Simulated" tags on AI outputs and fake integrations */
  showSimulationLabels: boolean
  /** Demo toolbar: Partner App offline mode */
  offline: boolean
}

export interface DemoState {
  data: DemoData
  demoNow: IsoDateTime
  flags: DemoFlags

  /** Move the demo clock forward. Time never goes backwards. */
  advanceTime: (minutes: number) => void
  /** Add chain-of-custody events; shipment and leg statuses are re-derived. */
  addEvents: (events: ShipmentEvent[]) => void
  /** CP-13: create a shipment (legs, events, credit / wallet, spend). Returns the LR. Throws QuoteError / NoPartnerError. */
  bookShipment: (input: BookingInput) => Id
  /** Add or update a consignee (CP-13 Step 2, CP-30) */
  saveConsignee: (consignee: Consignee) => void
  /** CP-13 "Save as draft" and its removal once booked */
  saveDraft: (draft: BookingDraft) => void
  deleteDraft: (id: Id) => void
  setFlag: <K extends keyof DemoFlags>(flag: K, value: DemoFlags[K]) => void
  /** Restore the seed data in every app (other tabs follow via sync). */
  resetDemo: () => void
}

export type PersistedDemoState = Pick<DemoState, 'data' | 'demoNow' | 'flags'>

export const initialFlags: DemoFlags = { showSimulationLabels: false, offline: false }

export function freshState(): PersistedDemoState {
  return { data: buildSeed(), demoNow: DEMO_START, flags: { ...initialFlags } }
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...freshState(),

      advanceTime: (minutes) => {
        if (minutes <= 0) return
        set((s) => {
          const demoNow = addMinutes(s.demoNow, minutes)
          // Background shipments move along their simulated journeys (ERP spec §11.1).
          return { demoNow, data: advanceJourneys(s.data, s.demoNow, demoNow) }
        })
      },

      addEvents: (events) => set((s) => ({ data: applyEvents(s.data, events, s.demoNow) })),

      bookShipment: (input) => {
        const { data, demoNow } = get()
        const result = bookShipment(data, input, demoNow)
        set({ data: result.data })
        return result.shipmentId
      },

      saveConsignee: (consignee) => set((s) => ({ data: { ...s.data, consignees: { ...s.data.consignees, [consignee.id]: consignee } } })),

      saveDraft: (draft) => set((s) => ({ data: { ...s.data, drafts: { ...s.data.drafts, [draft.id]: draft } } })),

      deleteDraft: (id) =>
        set((s) => {
          const drafts = { ...s.data.drafts }
          delete drafts[id]
          return { data: { ...s.data, drafts } }
        }),

      setFlag: (flag, value) => set((s) => ({ flags: { ...s.flags, [flag]: value } })),

      resetDemo: () => set(freshState()),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedDemoState => ({ data: s.data, demoNow: s.demoNow, flags: s.flags }),
      // Old saved data can't be trusted against a new seed: start fresh.
      migrate: () => freshState(),
    },
  ),
)
