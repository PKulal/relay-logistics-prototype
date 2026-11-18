/** Partner App bottom tabs by role — PA spec §4.1 / PA-04. */
import { CalendarCheck, Home, ListTodo, Menu, PackageOpen, ScanLine, Send, Truck, type LucideIcon } from 'lucide-react'
import type { FieldRole } from '@shared/types'

export interface Tab {
  path: string
  labelKey: string
  screenId: string
  icon: LucideIcon
  phase: number
}

const home: Tab = { path: '', labelKey: 'nav.pa.home', screenId: 'PA-05', icon: Home, phase: 2 }
const scan: Tab = { path: 'scan', labelKey: 'nav.pa.scan', screenId: 'PA-07', icon: ScanLine, phase: 2 }
const myDay: Tab = { path: 'my-day', labelKey: 'nav.pa.myDay', screenId: 'PA-09', icon: CalendarCheck, phase: 5 }
const more: Tab = { path: 'more', labelKey: 'nav.pa.more', screenId: 'PA-08, PA-10 to PA-13', icon: Menu, phase: 5 }

export const TABS: Record<FieldRole, Tab[]> = {
  rider: [home, { path: 'tasks', labelKey: 'nav.pa.tasks', screenId: 'PA-06', icon: ListTodo, phase: 2 }, scan, myDay, more],
  driver: [home, { path: 'trip', labelKey: 'nav.pa.trip', screenId: 'PA-21', icon: Truck, phase: 2 }, scan, myDay, more],
  hub: [
    { ...home, screenId: 'PA-25' },
    { path: 'inbound', labelKey: 'nav.pa.inbound', screenId: 'PA-26', icon: PackageOpen, phase: 2 },
    scan,
    { path: 'outbound', labelKey: 'nav.pa.outbound', screenId: 'PA-29', icon: Send, phase: 2 },
    more,
  ],
}

/** Opened from the SOS button in the top bar */
export const SOS_SCREEN = { path: 'sos', labelKey: 'nav.pa.sos', screenId: 'PA-12', phase: 4 }
/** Opened from the sync indicator */
export const SYNC_SCREEN = { path: 'sync', labelKey: 'nav.pa.sync', screenId: 'PA-13', phase: 5 }
