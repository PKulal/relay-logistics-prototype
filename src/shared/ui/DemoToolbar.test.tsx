import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { DemoToolbar } from './DemoToolbar'
import { TooltipProvider } from './tooltip'

const renderToolbar = () =>
  render(
    <MemoryRouter initialEntries={['/erp']}>
      <TooltipProvider>
        <DemoToolbar />
      </TooltipProvider>
    </MemoryRouter>,
  )

describe('DemoToolbar', () => {
  beforeEach(() => useDemoStore.getState().resetDemo())

  it('starts collapsed, showing the demo clock', () => {
    renderToolbar()
    expect(screen.getByRole('button', { name: 'Open demo controls' })).toHaveTextContent('Mon 23-Nov 10:00')
    expect(screen.queryByRole('region', { name: 'Demo controls' })).not.toBeInTheDocument()
  })

  it('advances the clock by an hour and a day', () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Open demo controls' }))
    fireEvent.click(screen.getByRole('button', { name: '+1 hour' }))
    expect(useDemoStore.getState().demoNow).toBe('2026-11-23T11:00:00+05:30')
    fireEvent.click(screen.getByRole('button', { name: '+1 day' }))
    expect(useDemoStore.getState().demoNow).toBe('2026-11-24T11:00:00+05:30')
    expect(screen.getByRole('region', { name: 'Demo controls' })).toHaveTextContent('Tue 24-Nov 11:00')
  })

  it('toggles offline mode and simulation labels', () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Open demo controls' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Partner App offline' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show simulation labels' }))
    expect(useDemoStore.getState().flags).toEqual({ offline: true, showSimulationLabels: true, manualApprovals: false })
  })

  it('scenario actions: run weekly scoring publishes 16–22 Nov; inject exception raises a SwiftCity escalation', () => {
    useDemoStore.getState().resetDemo()
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Open demo controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run weekly scoring' }))
    expect(useDemoStore.getState().data.partners['P-FASTTRACK'].tier).toBe('probation')
    fireEvent.click(screen.getByRole('button', { name: 'Inject exception' }))
    expect(Object.values(useDemoStore.getState().data.exceptions).some((x) => x.type === 'missedScan' && x.ownerPartnerId === 'P-SWIFTCITY')).toBe(true)
  })

  it('resets only after confirmation', () => {
    useDemoStore.getState().advanceTime(600)
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Open demo controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo data' }))
    expect(useDemoStore.getState().demoNow).toBe('2026-11-23T20:00:00+05:30')
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(useDemoStore.getState().demoNow).toBe('2026-11-23T10:00:00+05:30')
  })

  it("completes Deccan's third trial trip once (the hero trip TRP-2026-0931)", () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Open demo controls' }))
    fireEvent.click(screen.getByRole('button', { name: "Complete Deccan's third trial trip" }))
    expect(useDemoStore.getState().data.partners['P-DECCAN'].trial).toMatchObject({ tripsDone: 3, score: 89 })
    expect(useDemoStore.getState().data.partners['P-DECCAN'].trial!.jobs!.at(-1)).toMatchObject({ ref: 'TRP-2026-0931', simulated: true, onTime: true })
    // The hero trip itself is untouched
    expect(useDemoStore.getState().data.trips['TRP-2026-0931'].status).toBe('planned')
    expect(screen.getByRole('button', { name: "Complete Deccan's third trial trip" })).toBeDisabled()
  })
})
