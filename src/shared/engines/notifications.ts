/**
 * In-app notification centre (CP-36, PP-38, PA-08, ERP header bell): which
 * notifications a viewer sees, and which need an action from them.
 */
import type { AppKey, Id, Notification } from '@shared/types'

export interface Viewer {
  app: AppKey
  userId?: Id
  customerId?: Id
  partnerId?: Id
  /** ERP role or partner-user role */
  role?: string
  /** ERP super admin sees every ERP notification */
  all?: boolean
}

/** A notification is for the viewer when every audience field it sets matches. Newest first. */
export function notificationsFor(list: Record<Id, Notification>, v: Viewer): Notification[] {
  return Object.values(list)
    .filter((n) => {
      const a = n.audience
      if (a.app !== v.app) return false
      if (v.all) return true
      if (a.userId && a.userId !== v.userId) return false
      if (a.customerId && a.customerId !== v.customerId) return false
      if (a.partnerId && a.partnerId !== v.partnerId) return false
      if (a.role && a.role !== v.role) return false
      return true
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
}

/** Screens where the viewer has to decide or do something (assumed). */
const ACTION_LINKS = ['/exceptions', '/invoices', '/billing', '/claims', '/help', '/onboarding', '/jobs', '/escalations', '/case', '/approvals', '/suspensions', '/payables', '/applications']

export const actionNeeded = (n: Notification) => !n.read && !!n.link && ACTION_LINKS.some((p) => n.link!.includes(p))

export const unreadCount = (list: Record<Id, Notification>, v: Viewer) => notificationsFor(list, v).filter((n) => !n.read).length

/** The LR or record named in a notification body, if any. */
export const recordOf = (n: Notification) => /LGS-[A-Z]{3}-\d{6}|JOB-\d{6}-L\d|TKT-\d{4}-\d+|LGS\/[A-Z]{2}\/[\d-]+\/\d+/.exec(`${n.title} ${n.body}`)?.[0]
