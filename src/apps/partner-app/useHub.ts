import { useMemo } from 'react'
import { hubItems } from '@shared/engines/hub'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import type { Tone } from '@shared/engines/hub'
import { useFieldSession } from './useFieldSession'

/** Destination colours from the status tokens (PA-27 "very large text + colour"). */
export const TONE_CLASS: Record<Tone, string> = {
  info: 'border-status-info bg-status-info-bg text-status-info',
  success: 'border-status-success bg-status-success-bg text-status-success',
  warning: 'border-status-warning bg-status-warning-bg text-status-warning',
  neutral: 'border-status-neutral bg-status-neutral-bg text-status-neutral',
}

/** The hub staff member's hub and everything passing it today. hubId is undefined for other roles. */
export function useHub() {
  const { staff, partner } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const hubId = staff.role === 'hub' ? staff.hubId : undefined
  const items = useMemo(() => (hubId ? hubItems(data, hubId, now) : []), [data, hubId, now])
  return { staff, partner, data, now, hubId, hub: hubId ? data.hubs[hubId] : undefined, items }
}
