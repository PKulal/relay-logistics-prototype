import { useData } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'

/** The logged-in rider / driver / hub staff and their partner. Only used inside PartnerAppApp. */
export function useFieldSession() {
  const userId = useSessionUser('partnerApp')
  const staff = useData((d) => (userId ? d.fieldStaff[userId] : undefined))
  const partner = useData((d) => (staff ? d.partners[staff.partnerId] : undefined))
  if (!staff || !partner) throw new Error('useFieldSession used outside a logged-in Partner App')
  return { staff, partner }
}
