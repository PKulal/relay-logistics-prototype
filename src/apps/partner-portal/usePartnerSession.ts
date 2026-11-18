import { useData } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'

/** The logged-in Partner Portal user and their partner. Only used inside PartnerPortalApp. */
export function usePartnerSession() {
  const userId = useSessionUser('partnerPortal')
  const user = useData((d) => (userId ? d.partnerUsers[userId] : undefined))
  const partner = useData((d) => (user ? d.partners[user.partnerId] : undefined))
  if (!user || !partner) throw new Error('usePartnerSession used outside a logged-in Partner Portal')
  return { user, partner }
}
