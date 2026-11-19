import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PP11Dashboard from './PP11Dashboard'
import PP12JobInbox from './PP12JobInbox'
import PP13JobDetail from './PP13JobDetail'
import PP14Assign from './PP14Assign'

function bookHero() {
  useDemoStore.getState().bookShipment({
    customerId: 'C-SHARMA',
    bookedByUserId: 'CU-PRIYA',
    pickupLocationId: 'PL-OKHLA',
    consigneeId: 'CN-HED',
    serviceKind: 'ptl',
    service: 'expressPtl',
    paymentMode: 'tbb',
    addOns: { appointment: true, insurance: true, specialHandling: false },
    invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 },
    hsn: '8537',
    goodsDescription: 'LT switchgear panels',
    pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20 })),
    pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  })
}

function renderPortal(userId: string, path: string) {
  useSession.setState({ sessions: {} })
  useSession.getState().login('partnerPortal', userId)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner" element={<PP11Dashboard />} />
          <Route path="/partner/jobs" element={<PP12JobInbox />} />
          <Route path="/partner/jobs/assign" element={<PP14Assign />} />
          <Route path="/partner/jobs/:jobId" element={<PP13JobDetail />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('SwiftCity takes the hero pickup (PP-12 → PP-14 → PP-13)', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo()
    bookHero()
  })

  it('Neha sees the offer, accepts and assigns Ravi with his tempo', async () => {
    renderPortal('PU-NEHA', '/partner/jobs')
    const table = await screen.findByRole('table')
    const row = (await within(table).findByText('JOB-000781-L1', {}, { timeout: 15000 })).closest('tr')!
    expect(row).toHaveTextContent('Pickup')
    expect(row).toHaveTextContent('Sharma Electricals 110020 → NCR CrossDock, Gurugram')
    expect(row).toHaveTextContent('6 pcs / 120 kg')
    expect(row).toHaveTextContent('₹250.00')
    expect(row).toHaveTextContent('30 min to accept')
    expect(row).not.toHaveTextContent('3,628') // never the customer's price

    fireEvent.click(within(row).getByRole('button', { name: /Accept and assign/ }))
    expect(await screen.findByRole('heading', { name: 'Assign to field staff' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Note to staff')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Ravi Kumar/ }))
    expect(screen.getByRole('combobox', { name: 'Vehicle' })).toHaveValue('V-DL01LT4521')
    fireEvent.click(screen.getByRole('button', { name: /^Assign$/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'JOB-000781-L1' })).toBeInTheDocument()
    expect(screen.getByText('Ravi Kumar · DL01LT4521')).toBeInTheDocument()
    const leg = useDemoStore.getState().data.legs['JOB-000781-L1']
    expect(leg).toMatchObject({ status: 'assigned', staffId: 'FS-RAVI', vehicleId: 'V-DL01LT4521' })
  })

  it('the assign screen needs a vehicle for the 120 kg pickup', async () => {
    useDemoStore.getState().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
    renderPortal('PU-NEHA', '/partner/jobs/assign?ids=JOB-000781-L1')
    fireEvent.click(screen.getByRole('radio', { name: /Ajay Yadav/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Vehicle' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^Assign$/ }))
    expect(screen.getByText('Choose a vehicle for this job.')).toBeInTheDocument()
    expect(useDemoStore.getState().data.legs['JOB-000781-L1'].status).toBe('accepted')
  })

  it('a partner cannot open another partner’s job', () => {
    renderPortal('PU-NEHA', '/partner/jobs/JOB-000781-L3')
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })
})

describe('PP-11 dashboard', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo()
    bookHero()
  })

  it('Operations: the hero pickup is waiting to be accepted; after the weekly run, score 86.2 Gold up 0.6', async () => {
    useDemoStore.getState().runWeeklyScoring('LS-MEERA')
    renderPortal('PU-NEHA', '/partner')
    expect(await screen.findByRole('heading', { name: '1 job to accept' })).toBeInTheDocument()
    expect(await screen.findByText('JOB-000781-L1', {}, { timeout: 15000 })).toBeInTheDocument()
    expect(screen.getByText('86.2')).toBeInTheDocument()
    expect(screen.getByText(/↑ 0.6 vs last week/)).toBeInTheDocument()
    expect(screen.queryByText('Next payout')).not.toBeInTheDocument()
  })

  it('Finance: next payout ₹1,84,063 on 27-Nov, no job widgets', async () => {
    renderPortal('PU-ANIL', '/partner')
    expect(await screen.findByText('₹1,84,063.00', {}, { timeout: 15000 })).toBeInTheDocument()
    expect(screen.getByText('On 27-Nov-2026 · deductions ₹300.00')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /to accept/ })).not.toBeInTheDocument()
  })

  it('a hub partner sees the hero leg already accepted and assigned through its API', async () => {
    renderPortal('PU-DEEPAK', '/partner/jobs?tab=assigned')
    const table = await screen.findByRole('table')
    expect(await within(table).findByText('JOB-000781-L2', {}, { timeout: 15000 })).toBeInTheDocument()
  })
})
