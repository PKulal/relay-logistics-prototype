import type { Customer, CustomerStatus } from '@shared/types'

export type StepState = 'done' | 'current' | 'pending'

const ORDER: CustomerStatus[] = ['lead', 'qualified', 'kyc', 'credit', 'contract', 'integration', 'pilot', 'live']

/** Source §6 steps the customer walks; credit only for credit accounts. */
export function onboardingSteps(c: Customer): { key: string; path?: string; state: StepState }[] {
  const at = ORDER.indexOf(c.status)
  const kyc = c.onboarding?.kyc?.status
  const credit = c.onboarding?.credit
  const state = (done: boolean, current: boolean): StepState => (done ? 'done' : current ? 'current' : 'pending')
  return [
    { key: 'account', state: 'done' },
    { key: 'qualification', path: '/customer/onboarding/qualification', state: state(at >= 1, true) },
    { key: 'kyc', path: '/customer/onboarding/kyc', state: state(kyc === 'verified', at >= 1) },
    ...(c.billing === 'credit' || credit ? [{ key: 'credit', path: '/customer/onboarding/credit', state: state(!!credit?.accepted, c.status === 'credit') }] : []),
    { key: 'contract', path: '/customer/onboarding/contract', state: state(at > 4, c.status === 'contract') },
    { key: 'integration', path: '/customer/onboarding/integration', state: state(at > 5, c.status === 'integration') },
    { key: 'pilot', path: '/customer/onboarding', state: state(at > 6, c.status === 'pilot') },
    { key: 'live', state: state(c.status === 'live', false) },
  ]
}

/** The screen for the step the account is on. */
export function currentStepPath(c: Customer): string {
  switch (c.status) {
    case 'lead':
      return '/customer/onboarding/qualification'
    case 'qualified':
    case 'kyc':
      return '/customer/onboarding/kyc'
    case 'credit':
      return '/customer/onboarding/credit'
    case 'contract':
      return '/customer/onboarding/contract'
    case 'integration':
      return '/customer/onboarding/integration'
    default:
      return '/customer/onboarding'
  }
}

/** Still onboarding: the tracker (CP-10) is home until the account is live. */
export const isOnboarding = (c: Customer) => !!c.onboarding && c.status !== 'live'

/** Booking opens once the contract is signed (CP-10 "Book first shipment"). */
export const canBookNow = (c: Customer) => !c.onboarding || ['integration', 'pilot', 'live'].includes(c.status)
