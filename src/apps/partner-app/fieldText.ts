/** Wording for Partner App notifications (PA-08); stored in English, shown in the staff member's language. */
import type { TFunction } from 'i18next'
import type { Notification } from '@shared/types'

export const LEG_ID = /^JOB-\d{6}-L\d$/

/** Field notifications are stored in English; the phone words them in the staff member's language. */
export function fieldTitle(n: Notification, t: TFunction): string {
  if (LEG_ID.test(n.title)) return t('pa08.k.newTask', { lr: n.body })
  const map: Record<string, string> = { 'Appointment booked': 'slotChanged', 'Task removed': 'taskRemoved', 'Customer chose reattempt': 'reattempt', 'Return to origin': 'rto', 'Sync failed': 'syncFailed' }
  return map[n.title] ? t(`pa08.k.${map[n.title]}`) : n.title
}
