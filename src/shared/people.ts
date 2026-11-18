/** Resolve any user / staff id in the data to a display name and a role key (timelines, audit). */
import type { DemoData, Id } from '@shared/types'

export interface Person {
  name: string
  /** i18n key, e.g. "roles.field.rider" */
  roleKey?: string
  /** Company or partner the person works for */
  org?: string
}

export function person(data: DemoData, id: Id): Person {
  if (id === 'system') return { name: 'Logisco' }
  const f = data.fieldStaff[id]
  if (f) return { name: f.name, roleKey: `roles.field.${f.role}`, org: data.partners[f.partnerId]?.shortName }
  const pu = data.partnerUsers[id]
  if (pu) return { name: pu.name, roleKey: `roles.partner.${pu.role}`, org: data.partners[pu.partnerId]?.shortName }
  const cu = data.customerUsers[id]
  if (cu) return { name: cu.name, roleKey: `roles.customer.${cu.role}`, org: data.customers[cu.customerId]?.shortName }
  const st = data.staff[id]
  if (st) return { name: st.name, roleKey: `roles.erp.${st.role}`, org: 'Logisco' }
  return { name: id }
}
