import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PartnerPortalApp from '@apps/partner-portal/PartnerPortalApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ErpApp from './ErpApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: ({ markers }: { markers: { id: string; tone: string }[] }) => <div data-testid="map">{markers.map((m) => `${m.id}:${m.tone}`).join(' ')}</div> }))
vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>()
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 200 }}>{children}</div> }
})

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Network: ERP-18 to ERP-21, PP-18, PP-19', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('SwiftCity asks for the new Noida pincodes; Karthik sees the gap, approves, the gap closes', () => {
    useSession.getState().login('partnerPortal', 'PU-VIKRAM')
    app('/partner/coverage')
    expect(screen.getByRole('row', { name: 'CR-0001' })).toHaveTextContent('Pending')

    useSession.getState().login('erp', 'LS-KARTHIK')
    app('/erp/network/gaps')
    expect(screen.getByTestId('map')).toHaveTextContent('201303:danger')
    const gap = within(screen.getByTestId('gaps')).getByRole('row', { name: 'Sector 18, Noida · 201303 First mile' })
    expect(gap).toHaveTextContent('Recruit')
    expect(within(screen.getByTestId('gaps')).getByRole('row', { name: 'Camp, Belagavi · 590001 Last mile' })).toHaveTextContent('NK Express')
    fireEvent.click(within(screen.getByRole('row', { name: 'CR-0001' })).getByRole('button', { name: 'Approve' }))
    expect(st().data.partners['P-SWIFTCITY'].coveragePincodes).toContain('201303')
    expect(within(screen.getByTestId('gaps')).getByRole('row', { name: 'Sector 18, Noida · 201303 First mile' })).toHaveTextContent('SwiftCity Couriers')
    fireEvent.click(within(within(screen.getByTestId('gaps')).getByRole('row', { name: 'Camp, Belagavi · 590001 Last mile' })).getByRole('button', { name: 'Create recruitment need' }))
    expect(Object.values(st().data.recruitmentNeeds)).toMatchObject([{ legType: 'lastMile', place: '590001', open: true }])

    useSession.getState().login('partnerPortal', 'PU-VIKRAM')
    app('/partner/coverage')
    expect(screen.getByRole('row', { name: 'CR-0001' })).toHaveTextContent('Approved')
    expect(within(screen.getByTestId('my-pincodes')).getByRole('row', { name: '201303' })).toBeInTheDocument()
  })

  it('ERP-18 and ERP-19: edit ODA and a lane; ERP-20: Karthik proposes, Rahul approves', () => {
    useSession.getState().login('erp', 'LS-KARTHIK')
    app('/erp/network/pincodes')
    fireEvent.click(screen.getByRole('switch', { name: 'ODA for 581110' }))
    expect(st().data.pincodes['581110'].oda).toBe(false)
    expect(within(screen.getByTestId('pincodes')).getByRole('row', { name: '201303' })).toHaveTextContent('First mile: no partner')

    app('/erp/network/lanes')
    fireEvent.click(within(screen.getByRole('row', { name: 'Delhi NCR → Hubballi' })).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Transit days, Express PTL'), { target: { value: '4' } })
    tap('Save')
    expect(st().data.lanes['LN-DEL-HBL'].transitDays.expressPtl).toBe(4)

    app('/erp/network/rules')
    fireEvent.change(screen.getByLabelText(/^Destination hub hands over by/), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/^Reason for the change/), { target: { value: 'Earlier out-for-delivery' } })
    tap('Submit for approval')
    expect(screen.getByTestId('pending-change')).toHaveTextContent('Waiting for a second approver')

    useSession.getState().login('erp', 'LS-RAHUL')
    app('/erp/network/rules')
    fireEvent.click(within(screen.getByTestId('pending-change')).getByRole('button', { name: 'Approve' }))
    expect(st().data.settings.destHubHandoverBy).toBe('09:00')
  })

  it('PP-18: SwiftCity marks a day closed and the engine stops offering it', () => {
    useSession.getState().login('partnerPortal', 'PU-NEHA')
    app('/partner/capacity')
    fireEvent.click(screen.getByRole('button', { name: '30-Nov-2026' }))
    fireEvent.click(within(screen.getByTestId('day-editor')).getByRole('switch', { name: 'Holiday / closed' }))
    tap('Save day')
    expect(st().data.partners['P-SWIFTCITY'].closedDates).toContain('2026-11-30')
    expect(screen.getByRole('button', { name: '30-Nov-2026' })).toHaveTextContent('Closed')
  })
})
