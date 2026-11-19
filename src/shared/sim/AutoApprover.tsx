/**
 * SIMULATED Logisco back office for the demo (seed-data.md §5 "New sign-up …
 * automatic approvals after short delays"): KYC flags, credit applications,
 * partner network-fit, partner KYC and hub audits are decided by the rules a
 * few seconds after they arrive. The Demo toolbar's "Manual approvals" switch
 * turns this off so an ERP user decides instead (ERP-11, ERP-12, ERP-27,
 * ERP-30). Runs only in the visible tab, so two tabs don't race.
 */
import { useEffect } from 'react'
import { useData, useFlags } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { pendingDecisions, type DecisionKind } from '@shared/store/onboardingActions'
import { pendingPartnerDecisions, type PartnerDecisionKind } from '@shared/store/partnerOnboardingActions'

export const AUTO_DECISION_MS = 4000

export function AutoApprover() {
  const { manualApprovals } = useFlags()
  const pending = useData((d) =>
    [...pendingDecisions(d).map((p) => `c:${p.customerId}:${p.kind}`), ...pendingPartnerDecisions(d).map((p) => `p:${p.applicationId}:${p.kind}`)].join('|'),
  )
  useEffect(() => {
    if (manualApprovals || !pending) return
    const timers = pending.split('|').map((key) => {
      const [who, id, kind] = key.split(':')
      return setTimeout(() => {
        if (document.visibilityState !== 'visible') return
        if (who === 'c') useDemoStore.getState().autoDecide(id, kind as DecisionKind)
        else useDemoStore.getState().autoDecidePartner(id, kind as PartnerDecisionKind)
      }, AUTO_DECISION_MS)
    })
    return () => timers.forEach(clearTimeout)
  }, [pending, manualApprovals])
  return null
}
