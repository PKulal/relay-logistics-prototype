import { Navigate } from 'react-router-dom'
import { useCustomerSession } from '../useCustomerSession'
import { currentStepPath } from './steps'

/** While onboarding, the dashboard and booking lead to the current step. */
export default function OnboardingHome() {
  const { customer } = useCustomerSession()
  return <Navigate to={currentStepPath(customer)} replace />
}
