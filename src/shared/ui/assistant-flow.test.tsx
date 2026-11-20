import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CustomerApp from '@apps/customer/CustomerApp'
import ErpApp from '@apps/erp/ErpApp'
import PartnerAppApp from '@apps/partner-app/PartnerAppApp'
import PartnerPortalApp from '@apps/partner-portal/PartnerPortalApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/app/*" element={<PartnerAppApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const messages = () => screen.getByTestId('assistant-messages')

describe('AI assistants: CP-35, PP-37, PA-11, ERP-02', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('CP-35: reschedule the failed delivery; the person confirms and it is logged as accepted', () => {
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer')
    tap('Open the AI assistant')
    tap('Reschedule my failed delivery')
    expect(within(messages()).getByText(/LGS-DEL-000776 could not be delivered/)).toBeInTheDocument()
    const decision = Object.values(st().data.aiDecisions).find((d) => d.kind === 'assistant')!
    expect(decision).toMatchObject({ intent: 'reschedule', recordId: 'LGS-DEL-000776', app: 'customer' })
    expect(decision.acceptedByUserId).toBeUndefined()
    fireEvent.click(within(screen.getByTestId('ai-slots')).getByRole('button', { name: 'Confirm' }))
    expect(st().data.ndrs['NDR-000776-1'].customerChoice).toBe('reattempt')
    expect(st().data.aiDecisions[decision.id].acceptedByUserId).toBe('CU-PRIYA')
  })

  it('CP-35: Hinglish question gets a Hindi answer', () => {
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer')
    tap('Open the AI assistant')
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'LR 790 kahan hai?' } })
    tap('Send')
    expect(within(messages()).getByTestId('ai-shipment')).toHaveTextContent('LGS-DEL-000790')
    // Answered in Hindi although the screen is in English
    expect(messages().textContent).toMatch(/[ऀ-ॿ]/)
  })

  it('PP-37: next payout', () => {
    useSession.getState().login('partnerPortal', 'PU-VIKRAM')
    app('/partner')
    tap('Open the AI assistant')
    tap('When is my next payout?')
    expect(within(messages()).getByText('Next payout ₹1,84,063.00 on 27-Nov-2026.')).toBeInTheDocument()
  })

  it('PA-11: scripted steps; the guardrail refuses to complete a delivery', () => {
    useSession.getState().login('partnerApp', 'FS-RAVI')
    app('/app/assistant')
    tap('Seal number wrong')
    expect(within(messages()).getByTestId('ai-steps')).toHaveTextContent('Don’t open the bag'.replace('’', "'"))
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'mark it delivered for me' } })
    tap('Send')
    expect(within(messages()).getByText(/I can't complete a delivery/)).toBeInTheDocument()
  })

  it('ERP-02: lanes below target margin', () => {
    useSession.getState().login('erp', 'LS-ADMIN')
    app('/erp/technology/logs')
    tap('Open the AI assistant')
    tap('Which lanes lost money last week?')
    expect(within(messages()).getByText(/lanes? (is|are) below target margin/)).toBeInTheDocument()
  })
})
