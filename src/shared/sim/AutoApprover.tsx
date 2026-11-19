/**
 * SIMULATED Logisco back office for the demo (seed-data.md §5 "New sign-up …
 * automatic approvals after short delays"): KYC flags and credit applications
 * are decided by the rules a few seconds after they arrive. The Demo toolbar's
 * "Manual approvals" switch turns this off so an ERP user decides instead
 * (ERP-27, ERP-30). Runs only in the visible tab, so two tabs don't race.
 */
import { useEffect } from 'react'
import { useData, useFlags } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { pendingDecisions } from '@shared/store/onboardingActions'

export const AUTO_DECISION_MS = 4000

export function AutoApprover() {
  const { manualApprovals } = useFlags()
  const pending = useData((d) => pendingDecisions(d).map((p) => `${p.customerId}:${p.kind}`).join('|'))
  useEffect(() => {
    if (manualApprovals || !pending) return
    const timers = pending.split('|').map((key) => {
      const [customerId, kind] = key.split(':') as [string, 'kyc' | 'credit']
      return setTimeout(() => {
        if (document.visibilityState === 'visible') useDemoStore.getState().autoDecide(customerId, kind)
      }, AUTO_DECISION_MS)
    })
    return () => timers.forEach(clearTimeout)
  }, [pending, manualApprovals])
  return null
}
