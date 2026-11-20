/**
 * PP-38 Notification centre — docs/02-partner-portal.md (bell icon). Support
 * tickets to Logisco are not built: the client document has no basis for them
 * (partner problems go through PP-13 and escalations through PP-20).
 */
import { NotificationCentre } from '@shared/ui/NotificationCentre'
import { usePartnerSession } from './usePartnerSession'

export default function PP38Notifications() {
  const { user, partner } = usePartnerSession()
  return <NotificationCentre viewer={{ app: 'partnerPortal', partnerId: partner.id, userId: user.id, role: user.role }} />
}
