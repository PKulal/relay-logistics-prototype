import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Launcher from './Launcher'

it('shows a card for each of the four apps', () => {
  render(
    <MemoryRouter>
      <Launcher />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: /Customer Portal/ })).toHaveAttribute('href', '/customer')
  expect(screen.getByRole('link', { name: /Partner Portal/ })).toHaveAttribute('href', '/partner')
  expect(screen.getByRole('link', { name: /Partner App/ })).toHaveAttribute('href', '/app')
  expect(screen.getByRole('link', { name: /Control Tower/ })).toHaveAttribute('href', '/erp')
})
