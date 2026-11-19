/**
 * Partner Portal menu — PP spec §4.2: shown by partner TYPE, then filtered by
 * the §3.3 permission matrix for the user's ROLE.
 */
import {
  Activity,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  FileWarning,
  Gauge,
  Inbox,
  LayoutDashboard,
  Map,
  PackageX,
  Route,
  Settings,
  ShieldAlert,
  ShieldX,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import type { NavGroup } from '@shared/nav'
import type { Partner, PartnerRole, PartnerType } from '@shared/types'

export interface PartnerCtx {
  role: PartnerRole
  partner: Partner
}

const roles =
  (...allowed: PartnerRole[]) =>
  (c: PartnerCtx) =>
    allowed.includes(c.role)
const types =
  (...allowed: PartnerType[]) =>
  (c: PartnerCtx) =>
    allowed.includes(c.partner.type)
const all =
  (...checks: ((c: PartnerCtx) => boolean)[]) =>
  (c: PartnerCtx) =>
    checks.every((f) => f(c))

/** Hub screens: Type F, Type E with a hub, Type B if it runs a hub (PP §4.2). */
const runsHub = (c: PartnerCtx) => c.partner.type === 'F' || c.partner.hubIds.length > 0
const ops = roles('admin', 'operations')
const money = roles('admin', 'finance')

export const partnerNav: NavGroup<PartnerCtx>[] = [
  {
    items: [
      // Partners not yet live see their onboarding tracker first (PP-10)
      { path: 'onboarding', labelKey: 'nav.pp.onboarding', screenId: 'PP-10', icon: ClipboardCheck, phase: 3, visible: (c) => c.partner.status !== 'live' },
      { path: '', labelKey: 'nav.pp.dashboard', screenId: 'PP-11', icon: LayoutDashboard, phase: 2 },
      { path: 'jobs', labelKey: 'nav.pp.jobs', screenId: 'PP-12', icon: Inbox, phase: 2, visible: ops },
      { path: 'live', labelKey: 'nav.pp.live', screenId: 'PP-15', icon: Activity, phase: 5, visible: ops },
      { path: 'trips', labelKey: 'nav.pp.trips', screenId: 'PP-16', icon: Route, phase: 5, visible: types('A', 'D', 'E') },
      { path: 'hub', labelKey: 'nav.pp.hub', screenId: 'PP-17', icon: Warehouse, phase: 5, visible: runsHub },
      { path: 'capacity', labelKey: 'nav.pp.capacity', screenId: 'PP-18', icon: CalendarRange, phase: 5, visible: ops },
      { path: 'coverage', labelKey: 'nav.pp.coverage', screenId: 'PP-19', icon: Map, phase: 5, visible: ops },
      { path: 'escalations', labelKey: 'nav.pp.escalations', screenId: 'PP-20', icon: FileWarning, phase: 4 },
      { path: 'delivery-exceptions', labelKey: 'nav.pp.deliveryExceptions', screenId: 'PP-21', icon: PackageX, phase: 4, visible: types('A', 'B', 'C') },
      { path: 'claims', labelKey: 'nav.pp.claims', screenId: 'PP-22', icon: ShieldAlert, phase: 4 },
      { path: 'scorecard', labelKey: 'nav.pp.scorecard', screenId: 'PP-23', icon: Gauge, phase: 5 },
      // PP-39: shown while the partner is suspended or offboarded (source §5.4)
      { path: 'case', labelKey: 'nav.pp.case', screenId: 'PP-39', icon: ShieldX, phase: 5, visible: (c) => c.partner.status === 'suspended' || c.partner.status === 'offboarded' },
      {
        path: 'finance',
        labelKey: 'nav.pp.finance',
        screenId: 'PP-25',
        icon: Wallet,
        phase: 4,
        children: [
          { path: 'finance/daily', labelKey: 'nav.pp.daily', screenId: 'PP-25', phase: 4, visible: money },
          { path: 'finance/invoices', labelKey: 'nav.pp.invoices', screenId: 'PP-26', phase: 4, visible: money },
          { path: 'finance/payouts', labelKey: 'nav.pp.payouts', screenId: 'PP-27', phase: 4, visible: money },
          { path: 'finance/cod', labelKey: 'nav.pp.cod', screenId: 'PP-28', phase: 4, visible: types('A', 'B', 'C') },
        ],
      },
      {
        path: 'resources',
        labelKey: 'nav.pp.resources',
        screenId: 'PP-29',
        icon: Users,
        phase: 5,
        children: [
          { path: 'staff', labelKey: 'nav.pp.staff', screenId: 'PP-29', phase: 5, visible: ops },
          { path: 'fleet', labelKey: 'nav.pp.fleet', screenId: 'PP-30', phase: 5, visible: all(ops, types('A', 'B', 'C', 'D', 'E')) },
          { path: 'hubs', labelKey: 'nav.pp.hubs', screenId: 'PP-31', phase: 5, visible: all(ops, runsHub) },
          { path: 'compliance', labelKey: 'nav.pp.compliance', screenId: 'PP-32', phase: 5 },
        ],
      },
      {
        path: 'settings',
        labelKey: 'nav.pp.settings',
        screenId: 'PP-33',
        icon: Settings,
        phase: 5,
        children: [
          { path: 'settings/company', labelKey: 'nav.pp.company', screenId: 'PP-33', phase: 5 },
          { path: 'settings/users', labelKey: 'nav.pp.users', screenId: 'PP-34', phase: 5, visible: roles('admin') },
          { path: 'settings/integration', labelKey: 'nav.pp.integration', screenId: 'PP-35', phase: 5, visible: all(roles('admin'), types('A', 'E')) },
          { path: 'settings/preferences', labelKey: 'nav.pp.preferences', screenId: 'PP-36', phase: 5 },
        ],
      },
      { path: 'help', labelKey: 'nav.pp.help', screenId: 'PP-38', icon: CircleHelp, phase: 5 },
    ],
  },
]
