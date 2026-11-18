import { useData } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'

/**
 * The logged-in Customer Portal user and their company. Only used inside
 * CustomerApp, which redirects to the persona picker when nobody is logged in.
 */
export function useCustomerSession() {
  const userId = useSessionUser('customer')
  const user = useData((d) => (userId ? d.customerUsers[userId] : undefined))
  const customer = useData((d) => (user ? d.customers[user.customerId] : undefined))
  if (!user || !customer) throw new Error('useCustomerSession used outside a logged-in Customer Portal')
  return { user, customer }
}
