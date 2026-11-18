import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useSession } from '@shared/store/session'
import Launcher from './Launcher'

const renderLauncher = () =>
  render(
    <MemoryRouter>
      <Launcher />
    </MemoryRouter>,
  )

describe('Launcher', () => {
  beforeEach(() => useSession.setState({ sessions: {} }))

  it('sends each app card to its persona picker when nobody is logged in', () => {
    renderLauncher()
    expect(screen.getByRole('link', { name: /Customer Portal/ })).toHaveAttribute('href', '/launch/customer')
    expect(screen.getByRole('link', { name: /Partner Portal/ })).toHaveAttribute('href', '/launch/partner-portal')
    expect(screen.getByRole('link', { name: /Partner App/ })).toHaveAttribute('href', '/launch/partner-app')
    expect(screen.getByRole('link', { name: /Control Tower/ })).toHaveAttribute('href', '/launch/erp')
  })

  it('goes straight into an app this tab is already logged in to', () => {
    useSession.getState().login('customer', 'CU-PRIYA')
    renderLauncher()
    const card = screen.getByRole('link', { name: /Customer Portal/ })
    expect(card).toHaveAttribute('href', '/customer')
    expect(card).toHaveTextContent('Signed in as Priya Sharma')
  })
})
