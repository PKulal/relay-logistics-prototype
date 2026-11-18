import { useData } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'

/** The logged-in Logisco staff member. Only used inside ErpApp, which redirects when nobody is logged in. */
export function useErpSession() {
  const userId = useSessionUser('erp')
  const user = useData((d) => (userId ? d.staff[userId] : undefined))
  if (!user) throw new Error('useErpSession used outside a logged-in ERP')
  return { user }
}
