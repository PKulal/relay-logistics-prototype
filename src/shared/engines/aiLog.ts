/**
 * ERP-43 audit and AI decision logs. Source §12 guardrails (every AI decision
 * logged with its reason; models reviewed monthly), §14 (audit logs).
 */
import type { AiDecision, AuditLog, DemoData, IsoDate, IsoDateTime } from '@shared/types'

/** Model review (seeded reference; INVENTED figures until real monitoring exists). Accuracy and fairness texts are i18n keys erp43.m.<kind>. */
export interface ModelReview {
  model: string
  kind: AiDecision['kind'] | 'creditRisk' | 'leadScore' | 'skuOutlier'
  nextReview: IsoDate
}

export const MODEL_REVIEWS: ModelReview[] = [
  { model: 'assignment-v1', kind: 'legAssignment', nextReview: '2026-12-15' },
  { model: 'margin-check-v1', kind: 'marginCheck', nextReview: '2026-12-15' },
  { model: 'eta-v1', kind: 'etaPrediction', nextReview: '2026-12-15' },
  { model: 'credit-risk-v1', kind: 'creditRisk', nextReview: '2026-12-15' },
  { model: 'lead-score-v1', kind: 'leadScore', nextReview: '2027-01-15' },
  { model: 'sku-outlier-v1', kind: 'skuOutlier', nextReview: '2027-01-15' },
]

export interface DecisionRow {
  id: string
  at: IsoDateTime
  model: string
  record: string
  kind: AiDecision['kind']
  /** Words for the decision come from i18n with these values */
  decision: { partner?: string; grossPct?: number; belowTarget?: boolean }
  reason: { candidates?: number; score?: number; targetPct?: number }
  confidence: number
  acceptedBy?: string
}

export function decisionRows(data: DemoData): DecisionRow[] {
  return Object.values(data.aiDecisions)
    .map((d) => {
      const chosen = d.candidates?.find((c) => c.partnerId === d.chosenPartnerId)
      return {
        id: d.id,
        at: d.at,
        model: d.model,
        record: d.legId ?? d.recordId,
        kind: d.kind,
        decision: { partner: d.chosenPartnerId ? data.partners[d.chosenPartnerId]?.shortName : undefined, grossPct: d.margin?.grossPct, belowTarget: d.margin?.belowTarget },
        reason: { candidates: d.candidates?.filter((c) => c.eligible).length, score: chosen?.score, targetPct: d.margin?.targetPct },
        confidence: d.confidence,
        acceptedBy: d.acceptedByUserId,
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
}

export const auditRows = (data: DemoData): AuditLog[] => Object.values(data.auditLog).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))

/** Short before / after text for the audit table and CSV. */
export const brief = (v: unknown): string => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v).slice(0, 160))

/** CSV with quoted cells (Export). */
export function toCsv(rows: (string | number | undefined)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
}
