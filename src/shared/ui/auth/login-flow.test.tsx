import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const otp = () => fireEvent.change(screen.getByLabelText('One-time password'), { target: { value: '123456' } })

describe('Logins: CP-01/02/03, PP-01, PA-01/02/03, ERP-01', () => {
  beforeEach(() => {
    st().resetDemo()
    localStorage.removeItem('logisco-remember')
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('CP-01: logged-out users land on login; a persona chip and any 8-character password log in and are audited', async () => {
    app('/customer/billing')
    fireEvent.click(await screen.findByRole('button', { name: 'Priya · Admin' }, { timeout: 10000 }))
    tap('Log in')
    expect(useSession.getState().sessions.customer?.userId).toBe('CU-PRIYA')
    expect(Object.values(st().data.auditLog).some((a) => a.action === 'login' && a.userId === 'CU-PRIYA')).toBe(true)
  })

  it('CP-01: a disabled user is told; CP-02 mobile OTP logs in', () => {
    st().setCustomerUserEnabled('CU-RAMESH', false, 'CU-PRIYA')
    app('/customer/login')
    tap('Ramesh · Dispatch')
    tap('Log in')
    expect(screen.getByRole('alert')).toHaveTextContent('Your access has been disabled')
    fireEvent.click(screen.getByRole('tab', { name: 'Mobile OTP' }))
    type(/^Mobile number/, '99100 77881')
    tap('Get OTP')
    return screen.findByLabelText('One-time password').then(() => {
      otp()
      expect(useSession.getState().sessions.customer?.userId).toBe('CU-KAVITA')
    })
  })

  it('PP-01: a field-staff mobile is sent to the Partner App', async () => {
    app('/partner/login')
    type(/^Mobile number/, '98730 44556')
    tap('Get OTP')
    expect(await screen.findByRole('alert')).toHaveTextContent('Please use the Logisco Partner App')
  })

  it('PA-01 → PA-02 → first login opens PA-03', async () => {
    st().createStaff('P-SWIFTCITY', { name: 'Sohan Lal', role: 'rider', mobile: '98730 55001', photo: 'p', idProof: { kind: 'aadhaar', last4: '1234' }, language: 'hi' }, 'PU-VIKRAM')
    app('/app/welcome')
    tap('Continue')
    type('Mobile number', '98730 99999')
    tap('Get OTP')
    expect(await screen.findByRole('alert')).toHaveTextContent('This number is not registered')
    type('Mobile number', '98730 55001')
    tap('Get OTP')
    await screen.findByLabelText('One-time password')
    otp()
    expect(await screen.findByRole('heading', { name: /Set up your phone/ })).toBeInTheDocument()
  })

  it('ERP-01: company account, then the second factor', () => {
    app('/erp/login')
    tap(/Sign in with company account/)
    fireEvent.click(screen.getByRole('button', { name: /Finance/ }))
    otp()
    expect(useSession.getState().sessions.erp?.userId).toBeTruthy()
  })
})
