/** Who does a leg's work by default, and who in a partner's office handles jobs. */
import type { DemoData, FieldRole, Id, Leg, LegType } from '@shared/types'

export const ROLE_FOR: Record<LegType, FieldRole> = {
  firstMile: 'rider',
  lastMile: 'rider',
  originHub: 'hub',
  destHub: 'hub',
  lineHaul: 'driver',
}

/** First field staff member of the partner with the right role (Ravi, Pooja, Basavaraj, Manju for the hero). */
export function defaultAssignee(data: DemoData, leg: Pick<Leg, 'partnerId' | 'type'>): Id | undefined {
  return Object.values(data.fieldStaff).find((s) => s.partnerId === leg.partnerId && s.role === ROLE_FOR[leg.type])?.id
}

/** The partner office user who accepts jobs: Operations if there is one, else Admin. */
export function partnerOpsUser(data: DemoData, partnerId: Id): Id {
  const users = Object.values(data.partnerUsers).filter((u) => u.partnerId === partnerId)
  return (users.find((u) => u.role === 'operations') ?? users.find((u) => u.role === 'admin'))?.id ?? 'system'
}
