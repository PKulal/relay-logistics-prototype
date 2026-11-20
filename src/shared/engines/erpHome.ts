/**
 * ERP-02 Home: role-specific cards and the approvals inbox (maker-checker
 * items waiting for this user's role; source §12 guardrails: a person approves).
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, ErpRole, IsoDateTime } from '@shared/types'
import { slaRisks } from './controlTower'
import { ewbMonitor, ndrFollowUps } from './departments'
import { coverageGaps } from './network'
import { laneRows } from './pricingMonitor'
import { collectionsPriority } from './receivables'

export interface Approval {
  kind: 'rateCard' | 'settings' | 'coverage' | 'credit' | 'payoutBatch' | 'codRemittance' | 'closeCase' | 'claim' | 'kyc'
  ref: string
  to: string
  roles: ErpRole[]
}

export function approvals(data: DemoData, role: ErpRole): Approval[] {
  const all: Approval[] = [
    ...Object.values(data.rateCards).filter((r) => r.status === 'pendingApproval').map((r) => ({ kind: 'rateCard' as const, ref: r.name, to: '/erp/pricing/approvals', roles: ['pricing', 'leadership'] as ErpRole[] })),
    ...Object.values(data.settingsChanges).filter((s) => s.status === 'pending').map((s) => ({ kind: 'settings' as const, ref: s.id, to: '/erp/network/rules', roles: ['networkPlanning'] as ErpRole[] })),
    ...Object.values(data.coverageRequests).filter((c) => c.status === 'pending').map((c) => ({ kind: 'coverage' as const, ref: `${c.id} · ${data.partners[c.partnerId]?.shortName}`, to: '/erp/network/gaps', roles: ['networkPlanning'] as ErpRole[] })),
    ...Object.values(data.customers).filter((c) => c.onboarding?.credit?.status === 'underReview').map((c) => ({ kind: 'credit' as const, ref: c.shortName, to: '/erp/finance/credit', roles: ['finance'] as ErpRole[] })),
    ...Object.values(data.payoutBatches).filter((b) => b.status === 'pendingApproval').map((b) => ({ kind: 'payoutBatch' as const, ref: b.id, to: '/erp/finance/payouts', roles: ['finance'] as ErpRole[] })),
    ...Object.values(data.codRemittances).filter((r) => r.status === 'pendingApproval').map((r) => ({ kind: 'codRemittance' as const, ref: `${r.id} · ${data.customers[r.customerId]?.shortName}`, to: '/erp/finance/cod', roles: ['finance'] as ErpRole[] })),
    ...Object.values(data.suspensionCases).filter((c) => c.closeRequestedAt && c.step !== 'closed').map((c) => ({ kind: 'closeCase' as const, ref: `${c.id} · ${data.partners[c.partnerId]?.shortName}`, to: `/erp/partners/suspensions?case=${c.id}`, roles: ['leadership'] as ErpRole[] })),
    ...Object.values(data.claims).filter((c) => c.status === 'raised' || c.status === 'investigating').map((c) => ({ kind: 'claim' as const, ref: c.id, to: `/erp/claims/${c.id}`, roles: ['claims'] as ErpRole[] })),
    ...Object.values(data.applications).filter((a) => a.status === 'kyc' && !a.outcome).map((a) => ({ kind: 'kyc' as const, ref: `${a.ref} · ${data.partners[a.partnerId]?.shortName}`, to: `/erp/partners/kyc?app=${a.id}`, roles: ['partnerManagement'] as ErpRole[] })),
  ]
  return role === 'superAdmin' ? all : all.filter((a) => a.roles.includes(role))
}

export interface HomeCard {
  key: string
  value: number | string
  to: string
  tone?: 'danger' | 'warning'
}

export function homeCards(data: DemoData, role: ErpRole, now: IsoDateTime): HomeCard[] {
  const today = istDate(now)
  const openEx = Object.values(data.exceptions).filter((x) => x.status !== 'resolved').length
  const sos = Object.values(data.sosAlerts).filter((a) => a.status === 'active').length
  const byRole: Partial<Record<ErpRole, () => HomeCard[]>> = {
    controlTower: () => [
      { key: 'atRisk', value: slaRisks(data, now).length, to: '/erp/control-tower/at-risk', tone: 'warning' },
      { key: 'exceptions', value: openEx, to: '/erp/control-tower/exceptions' },
      { key: 'sos', value: sos, to: '/erp/control-tower/partner-health', tone: sos ? 'danger' : undefined },
    ],
    finance: () => [
      { key: 'payouts', value: Object.values(data.payoutBatches).filter((b) => b.status === 'pendingApproval').length, to: '/erp/finance/payouts' },
      { key: 'overdue', value: collectionsPriority(data, now).filter((c) => c.daysOverdue > 0).length, to: '/erp/finance/invoicing?tab=collections', tone: 'warning' },
      { key: 'cod', value: Object.values(data.codRemittances).filter((r) => r.status === 'pendingApproval').length, to: '/erp/finance/cod' },
    ],
    partnerManagement: () => [
      { key: 'applications', value: Object.values(data.applications).filter((a) => !['live', 'rejected'].includes(a.status)).length, to: '/erp/partners/applications' },
      { key: 'trials', value: Object.values(data.partners).filter((p) => p.status === 'trial').length, to: '/erp/partners/trials' },
      { key: 'probation', value: Object.values(data.partners).filter((p) => p.tier === 'probation').length, to: '/erp/partners/scoring', tone: 'warning' },
    ],
    pricing: () => [
      { key: 'rateCards', value: Object.values(data.rateCards).filter((r) => r.status === 'pendingApproval').length, to: '/erp/pricing/approvals' },
      { key: 'lanesBelow', value: laneRows(data, now).filter((r) => r.belowTarget).length, to: '/erp/pricing/margin', tone: 'warning' },
    ],
    sales: () => [
      { key: 'leads', value: Object.values(data.leads).filter((l) => l.stage === 'new').length, to: '/erp/sales/leads' },
      { key: 'rfqs', value: Object.values(data.rfqs).filter((r) => !['won', 'lost'].includes(r.status) && r.dueDate <= addDaysToDate(today, 7)).length, to: '/erp/sales/rfq' },
    ],
    customerSuccess: () => [
      { key: 'tickets', value: Object.values(data.tickets).filter((x) => x.customerId && x.status !== 'resolved' && x.status !== 'closed').length, to: '/erp/customer-success' },
      { key: 'ndr', value: ndrFollowUps(data, now).length, to: '/erp/customer-success' },
    ],
    networkPlanning: () => [
      { key: 'gaps', value: coverageGaps(data, now).length, to: '/erp/network/gaps', tone: 'warning' },
      { key: 'coverage', value: Object.values(data.coverageRequests).filter((c) => c.status === 'pending').length, to: '/erp/network/gaps' },
    ],
    claims: () => [
      { key: 'claims', value: Object.values(data.claims).filter((c) => !['settled', 'closed', 'rejected'].includes(c.status)).length, to: '/erp/claims/desk' },
      { key: 'insurer', value: Object.values(data.insurerClaims).filter((c) => c.status !== 'paid' && c.status !== 'rejected').length, to: '/erp/claims/insurer' },
    ],
    compliance: () => [
      { key: 'ewb', value: ewbMonitor(data, now).filter((e) => e.hoursLeft < 24).length, to: '/erp/compliance', tone: 'warning' },
      { key: 'dpdp', value: Object.values(data.dpdpRequests).filter((r) => r.status === 'open').length, to: '/erp/compliance' },
    ],
    hubOps: () => [
      { key: 'exceptions', value: openEx, to: '/erp/control-tower/exceptions' },
      { key: 'manifests', value: Object.values(data.manifests).filter((m) => m.status !== 'dispatched').length, to: '/erp/hub-ops' },
    ],
    hubAuditor: () => [{ key: 'kyc', value: Object.values(data.applications).filter((a) => a.status === 'kyc').length, to: '/erp/partners/kyc' }],
  }
  if (role === 'superAdmin') return [{ key: 'users', value: Object.keys(data.staff).length, to: '/erp/technology/users' }, { key: 'auditToday', value: Object.values(data.auditLog).filter((a) => istDate(a.at) === today).length, to: '/erp/technology/logs' }, { key: 'atRisk', value: slaRisks(data, now).length, to: '/erp/control-tower/at-risk' }]
  return byRole[role]?.() ?? []
}
