/**
 * Where the customer waits once KYC (and credit) are done: the rate card,
 * contract, integration and pilot steps are CP-08 to CP-10 (build plan Phase 3,
 * Part 3b). Until they are built this shows the step bar and the placeholder.
 */
import { useTranslation } from 'react-i18next'
import { ScreenPlaceholder } from '@shared/ui/Page'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

export default function OnboardingNext() {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  return (
    <div className="max-w-4xl">
      <OnboardingSteps customer={customer} current="contract" />
      <ScreenPlaceholder screenId="CP-08 to CP-10" title={t('onb.next')} phase={3} />
    </div>
  )
}
