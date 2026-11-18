/**
 * Customer Portal menu — CP spec §4.2, filtered by the §3.3 permission matrix
 * (items a role can't use are hidden, not disabled).
 */
import {
  BarChart3,
  Boxes,
  Calculator,
  CircleHelp,
  FileText,
  LayoutDashboard,
  PackagePlus,
  Receipt,
  Settings,
  ShieldAlert,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import type { NavGroup } from '@shared/nav'
import type { Customer, CustomerRole } from '@shared/types'

export interface CustomerCtx {
  role: CustomerRole
  customer: Customer
}

const roles =
  (...allowed: CustomerRole[]) =>
  (c: CustomerCtx) =>
    allowed.includes(c.role)

export const customerNav: NavGroup<CustomerCtx>[] = [
  {
    items: [
      { path: '', labelKey: 'nav.cp.dashboard', screenId: 'CP-11', icon: LayoutDashboard, phase: 2 },
      { path: 'quote', labelKey: 'nav.cp.quote', screenId: 'CP-12', icon: Calculator, phase: 2 },
      {
        path: 'book',
        labelKey: 'nav.cp.book',
        screenId: 'CP-13',
        icon: PackagePlus,
        phase: 2,
        visible: roles('admin', 'dispatch'),
        children: [
          { path: 'book', labelKey: 'nav.cp.bookSingle', screenId: 'CP-13', phase: 2 },
          { path: 'book/bulk', labelKey: 'nav.cp.bookBulk', screenId: 'CP-15', phase: 5 },
        ],
      },
      { path: 'shipments', labelKey: 'nav.cp.shipments', screenId: 'CP-16', icon: Truck, phase: 2 },
      { path: 'exceptions', labelKey: 'nav.cp.exceptions', screenId: 'CP-19', icon: TriangleAlert, phase: 4 },
      { path: 'claims', labelKey: 'nav.cp.claims', screenId: 'CP-22', icon: ShieldAlert, phase: 4 },
      {
        path: 'billing',
        labelKey: 'nav.cp.billing',
        screenId: 'CP-23',
        icon: Receipt,
        phase: 4,
        children: [
          // Wallet is for prepaid customers (CP-23); Dispatch sees the balance only
          { path: 'billing/wallet', labelKey: 'nav.cp.wallet', screenId: 'CP-23', phase: 4, visible: (c) => c.customer.billing === 'prepaid' },
          { path: 'billing/invoices', labelKey: 'nav.cp.invoices', screenId: 'CP-24', phase: 4, visible: roles('admin', 'finance') },
          { path: 'billing/cod', labelKey: 'nav.cp.cod', screenId: 'CP-25', phase: 4 },
        ],
      },
      { path: 'documents', labelKey: 'nav.cp.documents', screenId: 'CP-26', icon: FileText, phase: 5 },
      { path: 'analytics', labelKey: 'nav.cp.analytics', screenId: 'CP-27', icon: BarChart3, phase: 5 },
      {
        path: 'settings',
        labelKey: 'nav.cp.settings',
        screenId: 'CP-28',
        icon: Settings,
        phase: 5,
        children: [
          { path: 'settings/users', labelKey: 'nav.cp.users', screenId: 'CP-28', phase: 5, visible: roles('admin') },
          { path: 'settings/locations', labelKey: 'nav.cp.locations', screenId: 'CP-29', phase: 5 },
          { path: 'settings/address-book', labelKey: 'nav.cp.addressBook', screenId: 'CP-30', phase: 5 },
          { path: 'settings/skus', labelKey: 'nav.cp.skus', screenId: 'CP-31', icon: Boxes, phase: 5 },
          { path: 'settings/integrations', labelKey: 'nav.cp.integrations', screenId: 'CP-32', phase: 5, visible: roles('admin') },
          { path: 'settings/company', labelKey: 'nav.cp.company', screenId: 'CP-33', phase: 5 },
        ],
      },
      { path: 'help', labelKey: 'nav.cp.help', screenId: 'CP-37', icon: CircleHelp, phase: 5 },
    ],
  },
]
