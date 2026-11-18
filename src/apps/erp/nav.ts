/**
 * ERP menu — ERP spec §2.2 (16 departments + Leadership in 5 groups) and §3.2
 * (access by role). Leadership views every department; Super Admin sees
 * everything. Placeholder departments open the ERP-45 template.
 */
import {
  Award,
  BadgeIndianRupee,
  Building2,
  Cpu,
  Handshake,
  Headphones,
  Leaf,
  LayoutDashboard,
  Megaphone,
  Network,
  RadioTower,
  Scale,
  ShieldAlert,
  ShoppingCart,
  Tags,
  UserCog,
  Warehouse,
} from 'lucide-react'
import type { NavGroup } from '@shared/nav'
import type { ErpRole } from '@shared/types'

export interface ErpCtx {
  role: ErpRole
}

/** Roles that see every department (ERP §3.2). */
const SEES_ALL: ErpRole[] = ['leadership', 'superAdmin']

const roles =
  (...allowed: ErpRole[]) =>
  (c: ErpCtx) =>
    SEES_ALL.includes(c.role) || allowed.includes(c.role)

/** Placeholder departments (ERP-45): shown only to roles that see everything. */
const placeholder = roles()

export const erpNav: NavGroup<ErpCtx>[] = [
  {
    labelKey: 'nav.erp.group.leadership',
    items: [{ path: 'leadership', labelKey: 'nav.erp.leadership', screenId: 'ERP-04', icon: LayoutDashboard, phase: 5, visible: roles() }],
  },
  {
    labelKey: 'nav.erp.group.revenue',
    items: [
      {
        path: 'sales',
        labelKey: 'nav.erp.sales',
        screenId: 'ERP-26',
        icon: Handshake,
        phase: 3,
        children: [
          { path: 'sales/leads', labelKey: 'nav.erp.leads', screenId: 'ERP-26', phase: 3, visible: roles('sales') },
          { path: 'sales/onboarding', labelKey: 'nav.erp.customerOnboarding', screenId: 'ERP-27', phase: 3, visible: roles('sales') },
          { path: 'sales/accounts', labelKey: 'nav.erp.accounts', screenId: 'ERP-28', phase: 5, visible: roles('sales', 'customerSuccess', 'finance') },
          { path: 'sales/rfq', labelKey: 'nav.erp.rfq', screenId: 'ERP-29', phase: 5, visible: roles('sales') },
        ],
      },
      { path: 'marketing', labelKey: 'nav.erp.marketing', screenId: 'ERP-45', icon: Megaphone, phase: 5, visible: placeholder },
      {
        path: 'pricing',
        labelKey: 'nav.erp.pricing',
        screenId: 'ERP-22',
        icon: Tags,
        phase: 3,
        children: [
          { path: 'pricing/rate-cards', labelKey: 'nav.erp.rateCards', screenId: 'ERP-22', phase: 3, visible: roles('pricing') },
          { path: 'pricing/approvals', labelKey: 'nav.erp.rateApprovals', screenId: 'ERP-23', phase: 3, visible: roles('pricing') },
          { path: 'pricing/margin', labelKey: 'nav.erp.marginMonitor', screenId: 'ERP-24', phase: 5, visible: roles('pricing') },
          { path: 'pricing/simulator', labelKey: 'nav.erp.simulator', screenId: 'ERP-25', phase: 5, visible: roles('pricing', 'sales') },
        ],
      },
      { path: 'customer-success', labelKey: 'nav.erp.customerSuccess', screenId: 'ERP-39', icon: Headphones, phase: 5, visible: roles('customerSuccess') },
    ],
  },
  {
    labelKey: 'nav.erp.group.network',
    items: [
      {
        path: 'partners',
        labelKey: 'nav.erp.partners',
        screenId: 'ERP-11',
        icon: Building2,
        phase: 3,
        children: [
          { path: 'partners/applications', labelKey: 'nav.erp.applications', screenId: 'ERP-11', phase: 3, visible: roles('partnerManagement') },
          { path: 'partners/kyc', labelKey: 'nav.erp.kycDesk', screenId: 'ERP-12', phase: 3, visible: roles('partnerManagement', 'hubAuditor') },
          { path: 'partners/commercials', labelKey: 'nav.erp.commercials', screenId: 'ERP-13', phase: 3, visible: roles('partnerManagement', 'pricing') },
          { path: 'partners/trials', labelKey: 'nav.erp.trials', screenId: 'ERP-14', phase: 3, visible: roles('partnerManagement') },
          {
            path: 'partners/directory',
            labelKey: 'nav.erp.directory',
            screenId: 'ERP-15',
            phase: 5,
            visible: roles('partnerManagement', 'pricing', 'networkPlanning', 'controlTower', 'finance', 'claims'),
          },
          { path: 'partners/scoring', labelKey: 'nav.erp.scoring', screenId: 'ERP-16', phase: 5, visible: roles('partnerManagement') },
          { path: 'partners/suspensions', labelKey: 'nav.erp.suspensions', screenId: 'ERP-17', phase: 5, visible: roles('partnerManagement') },
        ],
      },
      {
        path: 'network',
        labelKey: 'nav.erp.network',
        screenId: 'ERP-18',
        icon: Network,
        phase: 5,
        children: [
          { path: 'network/pincodes', labelKey: 'nav.erp.pincodes', screenId: 'ERP-18', phase: 5, visible: roles('networkPlanning') },
          { path: 'network/lanes', labelKey: 'nav.erp.lanes', screenId: 'ERP-19', phase: 5, visible: roles('networkPlanning') },
          { path: 'network/rules', labelKey: 'nav.erp.legRules', screenId: 'ERP-20', phase: 5, visible: roles('networkPlanning') },
          { path: 'network/gaps', labelKey: 'nav.erp.coverageGaps', screenId: 'ERP-21', phase: 5, visible: roles('networkPlanning', 'partnerManagement') },
        ],
      },
      {
        path: 'control-tower',
        labelKey: 'nav.erp.controlTower',
        screenId: 'ERP-05',
        icon: RadioTower,
        phase: 2,
        children: [
          { path: 'control-tower/jobs', labelKey: 'nav.erp.jobBoard', screenId: 'ERP-05', phase: 2, visible: roles('controlTower', 'hubOps') },
          { path: 'control-tower/at-risk', labelKey: 'nav.erp.atRisk', screenId: 'ERP-06', phase: 4, visible: roles('controlTower') },
          { path: 'control-tower/exceptions', labelKey: 'nav.erp.exceptions', screenId: 'ERP-07', phase: 4, visible: roles('controlTower', 'customerSuccess') },
          { path: 'control-tower/partner-health', labelKey: 'nav.erp.partnerHealth', screenId: 'ERP-09', phase: 4, visible: roles('controlTower', 'partnerManagement') },
          { path: 'control-tower/daily-review', labelKey: 'nav.erp.dailyReview', screenId: 'ERP-10', phase: 4, visible: roles('controlTower') },
        ],
      },
      { path: 'hub-ops', labelKey: 'nav.erp.hubOps', screenId: 'ERP-40', icon: Warehouse, phase: 5, visible: roles('hubOps', 'controlTower') },
    ],
  },
  {
    labelKey: 'nav.erp.group.control',
    items: [
      {
        path: 'finance',
        labelKey: 'nav.erp.finance',
        screenId: 'ERP-30',
        icon: BadgeIndianRupee,
        phase: 3,
        children: [
          { path: 'finance/credit', labelKey: 'nav.erp.credit', screenId: 'ERP-30', phase: 3, visible: roles('finance', 'sales') },
          { path: 'finance/invoicing', labelKey: 'nav.erp.invoicing', screenId: 'ERP-31', phase: 4, visible: roles('finance') },
          { path: 'finance/payables', labelKey: 'nav.erp.payables', screenId: 'ERP-32', phase: 4, visible: roles('finance') },
          { path: 'finance/payouts', labelKey: 'nav.erp.payouts', screenId: 'ERP-33', phase: 4, visible: roles('finance', 'partnerManagement') },
          { path: 'finance/cod', labelKey: 'nav.erp.cod', screenId: 'ERP-34', phase: 4, visible: roles('finance') },
          { path: 'finance/accounts', labelKey: 'nav.erp.accounting', screenId: 'ERP-35', phase: 5, visible: roles('finance') },
        ],
      },
      {
        path: 'claims',
        labelKey: 'nav.erp.claims',
        screenId: 'ERP-36',
        icon: ShieldAlert,
        phase: 4,
        children: [
          { path: 'claims/desk', labelKey: 'nav.erp.claimsDesk', screenId: 'ERP-36', phase: 4, visible: roles('claims', 'finance') },
          { path: 'claims/insurer', labelKey: 'nav.erp.insurerClaims', screenId: 'ERP-38', phase: 5, visible: roles('claims') },
        ],
      },
      { path: 'compliance', labelKey: 'nav.erp.compliance', screenId: 'ERP-41', icon: Scale, phase: 5, visible: roles('compliance') },
      { path: 'quality', labelKey: 'nav.erp.quality', screenId: 'ERP-45', icon: Award, phase: 5, visible: placeholder },
    ],
  },
  {
    labelKey: 'nav.erp.group.enablers',
    items: [
      { path: 'hr', labelKey: 'nav.erp.hr', screenId: 'ERP-45', icon: UserCog, phase: 5, visible: placeholder },
      {
        path: 'technology',
        labelKey: 'nav.erp.technology',
        screenId: 'ERP-42',
        icon: Cpu,
        phase: 5,
        children: [
          { path: 'technology/users', labelKey: 'nav.erp.users', screenId: 'ERP-42', phase: 5, visible: roles() },
          { path: 'technology/logs', labelKey: 'nav.erp.logs', screenId: 'ERP-43', phase: 5, visible: roles('compliance') },
          { path: 'technology/settings', labelKey: 'nav.erp.settings', screenId: 'ERP-44', phase: 5, visible: roles() },
        ],
      },
      { path: 'procurement', labelKey: 'nav.erp.procurement', screenId: 'ERP-45', icon: ShoppingCart, phase: 5, visible: placeholder },
      { path: 'sustainability', labelKey: 'nav.erp.sustainability', screenId: 'ERP-45', icon: Leaf, phase: 5, visible: placeholder },
    ],
  },
]
