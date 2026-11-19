import type { Customer, CustomerStatus } from '@shared/types'

export type StepState = 'done' | 'current' | 'pending'

const ORDER: CustomerStatus[] = ['lead', 'qualified', 'kyc', 'credit', 'contract', 'integration', 'pilot', 'live']

/** Source §6 steps the customer walks; credit only for credit accounts. */
export function onboardingSteps(c: Customer): { key: string; path?: string; state: StepState }[] {
  const at = ORDER.indexOf(c.status)
  const kyc = c.onboarding?.kyc?.status
  const credit = c.onboarding?.credit
  const steps = [
    { key: 'account', state: 'done' as StepState },
    { key: 'qualification', path: '/customer/onboarding/qualification', state: (at >= 1 ? 'done' : 'current') as StepState },
    { key: 'kyc', path: '/customer/onboarding/kyc', state: (kyc === 'verified' ? 'done' : at >= 1 ? 'current' : 'pending') as StepState },
    ...(c.billing === 'credit' || credit
      ? [{ key: 'credit', path: '/customer/onboarding/credit', state: (credit?.accepted ? 'done' : c.status === 'credit' ? 'current' : 'pending') as StepState }]
      : []),
    { key: 'contract', state: (at > 4 ? 'done' : c.status === 'contract' ? 'current' : 'pending') as StepState },
    { key: 'integration', state: (at > 5 ? 'done' : 'pending') as StepState },
    { key: 'pilot', state: (at > 6 ? 'done' : 'pending') as StepState },
    { key: 'live', state: (c.status === 'live' ? 'done' : 'pending') as StepState },
  ]
  return steps
}

/** Where an onboarding customer lands (CP-10 in Part 3b; until then the current step). */
export function currentStepPath(c: Customer): string {
  switch (c.status) {
    case 'lead':
      return '/customer/onboarding/qualification'
    case 'qualified':
    case 'kyc':
      return '/customer/onboarding/kyc'
    case 'credit':
      return '/customer/onboarding/credit'
    default:
      return '/customer/onboarding/next'
  }
}

/** Still onboarding: booking and the dashboard wait until the account is in pilot or live. */
export const isOnboarding = (c: Customer) => !!c.onboarding && c.status !== 'pilot' && c.status !== 'live'
