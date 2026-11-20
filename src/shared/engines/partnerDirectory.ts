/**
 * ERP-15 Partner directory and Partner 360 (source §11 Dept 5: onboarding,
 * scorecards, tiers, contracts; §12 partner churn risk). Churn risk is a
 * SIMULATED AI score from score trend, open disputes, suspension and load.
 */
import { istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDateTime, Partner } from '@shared/types'
import { utilisation } from './network'
import { docRegister } from './partnerSettings'
import { scoresOf } from './scoring'

export type DirectoryStatus = 'onboarding' | 'trial' | 'live' | 'probation' | 'suspended' | 'offboarded'

export function directoryStatus(p: Partner): DirectoryStatus {
  if (p.status === 'offboarded' || p.status === 'suspended' || p.status === 'trial') return p.status
  if (p.status === 'live') return p.tier === 'probation' ? 'probation' : 'live'
  if (p.status === 'probation') return 'probation'
  return 'onboarding'
}

export type ChurnReason = 'scoreDown' | 'disputes' | 'suspension' | 'lowLoad' | 'probation'

export function partnerChurn(data: DemoData, partnerId: Id, now: IsoDateTime): { level: 'low' | 'medium' | 'high'; reasons: ChurnReason[] } {
  const p = data.partners[partnerId]
  const reasons: ChurnReason[] = []
  const pts: number[] = []
  const add = (r: ChurnReason, p: number) => {
    reasons.push(r)
    pts.push(p)
  }
  const scores = scoresOf(data, partnerId).filter((w) => w.published)
  const last = scores.at(-1)
  const prev = scores.at(-3)
  if (last && prev && last.total < prev.total - 2) add('scoreDown', 25)
  const disputes = Object.values(data.partnerInvoices).filter((i) => i.partnerId === partnerId && i.status === 'disputed').length
  if (disputes) add('disputes', 20)
  if (Object.values(data.suspensionCases).some((c) => c.partnerId === partnerId && c.step !== 'closed')) add('suspension', 40)
  if (p.tier === 'probation') add('probation', 20)
  const u = utilisation(data, partnerId, istDate(now), 1)[0]
  if (p.status === 'live' && u && u.capacity > 0 && u.pct < 20) add('lowLoad', 15)
  const total = pts.reduce((a, b) => a + b, 0)
  return { level: total >= 40 ? 'high' : total >= 20 ? 'medium' : 'low', reasons }
}

export interface DirectoryRow {
  partner: Partner
  status: DirectoryStatus
  cities: number
  lanes: number
  capacityPct: number
  docsDue: number
}

export function directory(data: DemoData, now: IsoDateTime): DirectoryRow[] {
  const today = istDate(now)
  return Object.values(data.partners)
    .map((partner) => {
      const cities = new Set(partner.coveragePincodes.map((c) => data.pincodes[c]?.city).filter(Boolean)).size
      const u = utilisation(data, partner.id, today, 1)[0]
      const docsDue = docRegister(data, partner.id, now).filter((r) => r.status === 'expired' || r.status === 'expiring').length
      return { partner, status: directoryStatus(partner), cities, lanes: partner.laneIds.length, capacityPct: u?.pct ?? 0, docsDue }
    })
    .sort((a, b) => a.partner.shortName.localeCompare(b.partner.shortName))
}
