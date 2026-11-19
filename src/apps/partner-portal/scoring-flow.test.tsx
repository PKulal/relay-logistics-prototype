import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from './PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))
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

describe('Scoring: ERP-16, PP-23, PP-24, ERP-17, PP-39', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Meera publishes 16–22 Nov: FastTrack → Probation, Bhiwandi → Silver with a plan; SwiftCity sees 86.2', () => {
    useSession.getState().login('erp', 'LS-MEERA')
    app('/erp/partners/scoring')
    const run = within(screen.getByTestId('score-run'))
    const fast = run.getByRole('row', { name: 'FastTrack Logistics' })
    expect(fast).toHaveTextContent('57.4')
    expect(fast).toHaveTextContent('Probation: volume cut 50%')
    expect(run.getByRole('row', { name: 'Bhiwandi Logistics' })).toHaveTextContent('Improvement plan')
    expect(run.getByRole('row', { name: 'SwiftCity Couriers' })).toHaveTextContent('14.422.813.217.014.34.586.2')
    tap('Publish scores')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish scores' }))
    expect(st().data.partners['P-FASTTRACK']).toMatchObject({ tier: 'probation', score: 57 })
    expect(screen.getByText(/Published by Meera Iyer/)).toBeInTheDocument()

    useSession.getState().login('partnerPortal', 'PU-ANIL')
    app('/partner/scorecard')
    expect(screen.getByTestId('total')).toHaveTextContent('86.2')
    expect(screen.getByRole('button', { name: 'Pickup adherence' })).toHaveTextContent('96% → 14.4')
    expect(screen.getByRole('button', { name: 'Damage, loss & shortage' })).toHaveTextContent('4 per 10k → 17.0')
    fireEvent.change(screen.getByRole('combobox', { name: 'Period' }), { target: { value: 'this' } })
    tap('On-time delivery / arrival')
    expect(screen.getByTestId('drill')).toHaveTextContent(/counted/)

    useSession.getState().login('partnerPortal', 'PU-SAMEER')
    app('/partner/scorecard/tier')
    expect(screen.getByTestId('benefits')).toHaveTextContent('Normal assignment')
    expect(screen.getByTestId('if-falls')).toHaveTextContent('Warning and coaching')
    expect(screen.getByTestId('plan')).toHaveTextContent('Your Logisco coordinator: Meera Iyer')
    tap('Acknowledge plan')
    expect(screen.getByTestId('plan')).toHaveTextContent('Acknowledged by Sameer Shaikh')
    expect(within(screen.getByTestId('tier-history')).getAllByRole('row')[1]).toHaveTextContent('Gold → Silver')
  })

  it('FastTrack: second week below 60 → case → freeze → transfer → settle → Rahul closes → PP-39 only', () => {
    act(() => {
      st().runWeeklyScoring('LS-MEERA')
      st().advanceTime(7 * 24 * 60)
      st().runWeeklyScoring('LS-MEERA')
    })
    const c = Object.values(st().data.suspensionCases)[0]
    expect(c).toMatchObject({ partnerId: 'P-FASTTRACK', auto: true })

    useSession.getState().login('partnerPortal', 'PU-IMRAN')
    app('/partner')
    expect(screen.getByTestId('case-banner')).toHaveTextContent(`Suspension review ${c.id}`)

    useSession.getState().login('erp', 'LS-MEERA')
    app(`/erp/partners/suspensions?case=${c.id}`)
    tap('Freeze new allocations')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Freeze new allocations' }))
    expect(st().data.partners['P-FASTTRACK'].status).toBe('suspended')
    for (const i of st().data.suspensionCases[c.id].inFlight) {
      const row = within(screen.getByTestId('in-flight')).getByRole('row', { name: i.legId })
      const transfer = within(row).getByRole('button', { name: /^Transfer/ })
      fireEvent.click(transfer.hasAttribute('disabled') ? within(row).getByRole('button', { name: 'Partner finishes' }) : transfer)
    }
    expect(st().data.suspensionCases[c.id].inFlight.some((i) => i.toPartnerId === 'P-DOORSTEP')).toBe(true)
    tap('Go to settlement')
    expect(screen.getByTestId('settlement')).toHaveTextContent('Final payout')
    tap('Submit for approval')
    expect(screen.queryByRole('button', { name: 'Approve and close' })).toBeNull()

    useSession.getState().login('erp', 'LS-RAHUL')
    app(`/erp/partners/suspensions?case=${c.id}`)
    tap('Approve and close')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and close' }))
    expect(st().data.partners['P-FASTTRACK'].status).toBe('offboarded')

    useSession.getState().login('partnerPortal', 'PU-IMRAN')
    app('/partner/jobs')
    expect(screen.getByRole('heading', { name: 'Suspension and offboarding' })).toBeInTheDocument()
    expect(screen.getByTestId('access')).toHaveTextContent('Revoked on')
    expect(screen.getByTestId('case-log')).toHaveTextContent('Step 1: new allocations frozen')
  })
})
