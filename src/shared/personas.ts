/**
 * Demo personas for the launcher's persona picker, built from the shared data
 * so they always match the seed. "Featured" personas are the ones the specs'
 * demo scripts use; the rest are listed under them.
 */
import type { AppKey, DemoData, Id } from '@shared/types'

export interface Persona {
  id: Id
  app: AppKey
  name: string
  /** i18n key for the role, e.g. "roles.customer.admin" */
  roleKey: string
  /** Company / partner / department line */
  org: string
  /** Mobile or email shown on the mock login */
  login: string
  featured: boolean
}

const FEATURED: Record<AppKey, Id[]> = {
  customer: ['CU-PRIYA', 'CU-RAMESH', 'CU-KAVITA', 'CU-SURESH'],
  partnerPortal: ['PU-VIKRAM', 'PU-NEHA', 'PU-ANIL', 'PU-PRAKASH', 'PU-SUNIL'],
  partnerApp: ['FS-RAVI', 'FS-POOJA', 'FS-BASAVARAJ', 'FS-MANJU'],
  erp: ['LS-SANJAY', 'LS-RAHUL', 'LS-MEERA', 'LS-LAKSHMI', 'LS-FARHAN', 'LS-DIVYA', 'LS-ADMIN'],
}

function order(app: AppKey, list: Persona[]): Persona[] {
  const rank = (p: Persona) => (FEATURED[app].includes(p.id) ? FEATURED[app].indexOf(p.id) : 1000)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.org.localeCompare(b.org) || a.name.localeCompare(b.name))
}

export function personasFor(app: AppKey, data: DemoData): Persona[] {
  const featured = (id: Id) => FEATURED[app].includes(id)
  switch (app) {
    case 'customer':
      return order(
        app,
        // CP-28: disabled users can't log in
        Object.values(data.customerUsers).filter((u) => u.status !== 'disabled').map((u) => ({
          id: u.id,
          app,
          name: u.name,
          roleKey: `roles.customer.${u.role}`,
          org: data.customers[u.customerId].shortName,
          login: u.mobile,
          featured: featured(u.id),
        })),
      )
    case 'partnerPortal':
      return order(
        app,
        // PP-34: disabled users can't log in
        Object.values(data.partnerUsers).filter((u) => u.status !== 'disabled').map((u) => ({
          id: u.id,
          app,
          name: u.name,
          roleKey: `roles.partner.${u.role}`,
          org: data.partners[u.partnerId].shortName,
          login: u.mobile,
          featured: featured(u.id),
        })),
      )
    case 'partnerApp':
      return order(
        app,
        // PP-29: deactivated or blocked staff have no app access
        Object.values(data.fieldStaff).filter((s) => (s.status ?? 'active') === 'active').map((s) => ({
          id: s.id,
          app,
          name: s.name,
          roleKey: `roles.field.${s.role}`,
          org: data.partners[s.partnerId].shortName,
          login: s.mobile,
          featured: featured(s.id),
        })),
      )
    case 'erp':
      return order(
        app,
        Object.values(data.staff).map((s) => ({
          id: s.id,
          app,
          name: s.name,
          roleKey: `roles.erp.${s.role}`,
          org: s.title,
          login: s.email,
          featured: featured(s.id),
        })),
      )
  }
}
