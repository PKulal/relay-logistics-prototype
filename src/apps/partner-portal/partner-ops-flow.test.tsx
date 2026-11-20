import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DEMO_START, buildSeed } from '@data/seed'
import { hubSummary, partnerAtRisk, tripsOf } from '@shared/engines/partnerOps'
import { useDemoStore } from '@shared/store'
import { changeTripVehicle } from '@shared/store/partnerOpsActions'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from './PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/*" element={<PartnerPortalApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('PP-15, PP-16, PP-17 engines', () => {
  it('SwiftCity: JOB-000790-L1 is at risk; Deccan runs TRP-2026-0931; NCR CrossDock hub summary', () => {
    const d = buildSeed()
    expect(partnerAtRisk(d, 'P-SWIFTCITY', DEMO_START).map((x) => x.leg.id)).toContain('JOB-000790-L1')
    expect(tripsOf(d, 'P-DECCAN').map((t) => t.id)).toContain('TRP-2026-0931')
    const s = hubSummary(d, 'HUB-GGN', DEMO_START)
    expect(s.expected).toBeGreaterThan(0)
    expect(s.inScanned).toBeGreaterThanOrEqual(s.sorted)
  })

  it('changing a trip vehicle asks for e-way bill Part B updates', () => {
    const d = buildSeed()
    const trip = d.trips['TRP-2026-0931']
    const other = Object.values(d.vehicles).find((v) => v.partnerId === 'P-DECCAN' && v.id !== trip.vehicleId)
    if (!other) return
    const next = changeTripVehicle(d, trip.id, other.id, trip.driverId, 'PU-PRAKASH', DEMO_START)
    expect(next.trips[trip.id].vehicleId).toBe(other.id)
    expect(Object.values(next.notifications).some((n) => n.title.startsWith('Vehicle changed'))).toBe(true)
  })
})

describe('PP-15, PP-16, PP-17 screens', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('PP-15 board and at-risk list for SwiftCity', () => {
    useSession.getState().login('partnerPortal', 'PU-VIKRAM')
    app('/partner/live')
    expect(screen.getByTestId('board')).toBeInTheDocument()
    expect(within(screen.getByTestId('at-risk')).getByRole('row', { name: 'JOB-000790-L1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Map' }))
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('PP-16 Deccan trip detail', () => {
    useSession.getState().login('partnerPortal', 'PU-PRAKASH')
    app('/partner/trips?trip=TRP-2026-0931')
    expect(screen.getByRole('heading', { name: 'TRP-2026-0931' })).toBeInTheDocument()
    expect(screen.getByTestId('trip-manifest')).toBeInTheDocument()
  })

  it('PP-17 NCR CrossDock hub', () => {
    useSession.getState().login('partnerPortal', 'PU-DEEPAK')
    app('/partner/hub')
    expect(screen.getByTestId('hub-summary')).toBeInTheDocument()
  })
})
