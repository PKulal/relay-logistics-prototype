import { create } from 'zustand'
import { buildBaseSeed, DEMO_START } from '@data/seed'
import type { DemoState } from './store'
import { initialFlags } from './store'
import { startSync } from './sync'

/** Two independent stores stand in for two browser tabs. The base seed keeps this fast. */
function makeTab() {
  return create<DemoState>()((set) => ({
    data: buildBaseSeed(),
    demoNow: DEMO_START,
    flags: { ...initialFlags },
    advanceTime: (m) => set({ demoNow: `+${m}` }),
    addEvents: () => {},
    bookShipment: () => '',
    saveConsignee: () => {},
    extendEwayBill: () => {},
    updatePartB: () => {},
    messageCustomer: () => {},
    logMaskedCall: () => {},
    acceptLegs: () => {},
    flagLeg: () => {},
    assignLegs: () => {},
    unassignLeg: () => {},
    reportProblem: () => {},
    arriveAtPickup: () => {},
    confirmPickup: () => {},
    markNotificationsRead: () => {},
    giveHandover: () => {},
    receiveHandover: () => {},
    inScan: () => {},
    sortPiece: () => undefined,
    removeFromBag: () => {},
    sealBag: () => {},
    dispatchManifest: () => {},
    receiveManifest: () => {},
    startTrip: () => {},
    reportHalt: () => {},
    arriveTrip: () => {},
    handOverAtArrival: () => {},
    giveToRider: () => {},
    receiveLoad: () => {},
    startRun: () => {},
    completeDelivery: () => {},
    setFlag: (flag, value) => set((s) => ({ flags: { ...s.flags, [flag]: value } })),
    resetDemo: () => set({ data: buildBaseSeed(), demoNow: DEMO_START }),
  }))
}

const flush = () => new Promise((r) => setTimeout(r, 50))

describe('cross-tab sync', () => {
  it('applies a change made in one tab to the other', async () => {
    const tabA = makeTab()
    const tabB = makeTab()
    const stopA = startSync(tabA)
    const stopB = startSync(tabB)

    tabA.getState().setFlag('showSimulationLabels', true)
    await flush()
    expect(tabB.getState().flags.showSimulationLabels).toBe(true)

    tabB.getState().advanceTime(60)
    await flush()
    expect(tabA.getState().demoNow).toBe('+60')

    stopA()
    stopB()
  })

  it('does not echo a received update back (no loops)', async () => {
    const tabA = makeTab()
    const tabB = makeTab()
    const stopA = startSync(tabA)
    const stopB = startSync(tabB)

    let updatesInA = 0
    const unsub = tabA.subscribe(() => (updatesInA += 1))
    tabA.getState().setFlag('offline', true)
    await flush()
    expect(updatesInA).toBe(1)

    unsub()
    stopA()
    stopB()
  })
})
