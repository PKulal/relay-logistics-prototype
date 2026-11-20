import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('Customer settings: CP-28, CP-31, CP-32, CP-36, CP-37', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    useSession.getState().login('customer', 'CU-PRIYA')
  })

  it('CP-28: Priya invites a user; she cannot disable herself, the last Admin', () => {
    app('/customer/settings/users')
    expect(within(screen.getByTestId('users')).getAllByRole('row')).toHaveLength(4)
    expect(within(screen.getByRole('row', { name: /Priya Sharma/ })).getByRole('button', { name: 'Disable' })).toBeDisabled()
    tap('Invite user')
    type(/Full name/, 'Neha Jain')
    type(/Work email/, 'neha@sharmaelectricals.in')
    type(/Mobile/, '98100 55667')
    tap('Send invite')
    expect(within(screen.getByRole('row', { name: /Neha Jain/ })).getByText('Invited')).toBeInTheDocument()
  })

  it('CP-31: two flagged SKUs; Accept as is sends one to Logisco', () => {
    app('/customer/settings/skus')
    expect(screen.getByText('20 SKUs · 2 flagged by AI')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('row', { name: 'LUG-KIT' })).getByRole('button', { name: 'Accept as is' }))
    expect(within(screen.getByRole('row', { name: 'LUG-KIT' })).getByText('With Logisco')).toBeInTheDocument()
  })

  it('CP-32: the seeded Tally key is masked; a test event returns 200', () => {
    app('/customer/settings/integrations')
    expect(within(screen.getByTestId('api-keys')).getByText('lg_sbx_••••91af')).toBeInTheDocument()
    tap('Send test event')
    expect(st().data.customers['C-SHARMA'].integrations.webhooks![0].lastTest?.status).toBe(200)
  })

  it('CP-36: bell count, Action needed tab, mark all read', () => {
    app('/customer')
    tap('Notifications, 2 unread')
    fireEvent.click(screen.getByRole('tab', { name: 'Action needed' }))
    expect(within(screen.getByTestId('notifications')).getAllByRole('button')).toHaveLength(2)
    tap('Mark all as read')
    expect(screen.getByText('Nothing needs your action')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('CP-37 ↔ ERP-39: raise, Logisco resolves, the customer confirms and it closes', () => {
    app('/customer/help')
    tap('Raise ticket')
    type(/Subject/, 'Pickup slot for Manesar')
    type(/Description/, 'Can pickups at Manesar start at 09:00?')
    tap('Submit')
    expect(screen.getByRole('heading', { name: /TKT-2026-3382/ })).toBeInTheDocument()
    st().replyTicket('TKT-2026-3382', 'Yes, from Monday.', true, 'LS-FARAH')
    app('/customer/help?ticket=TKT-2026-3382')
    expect(screen.getByText('Yes, from Monday.')).toBeInTheDocument()
    tap('Confirm resolved')
    expect(st().data.tickets['TKT-2026-3382'].status).toBe('closed')
  })
})
