import { Navigate } from 'react-router-dom'

/** While onboarding, the dashboard (and booking before the contract) lead to the tracker (CP-10). */
export default function OnboardingHome() {
  return <Navigate to="/customer/onboarding" replace />
}
