/**
 * ERP-06 SLA risk list (AI) — docs/04-erp-control-tower.md §6.3.
 * Source §11.1 "SLA Timers: AI ranks the 20 shipments most likely to fail
 * today"; §12 ETA & SLA breach prediction. AI suggests; a person confirms (§12
 * guardrails). SIMULATED model (engines/controlTower.ts).
 */
import { Bot } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { slaRisks, type RiskReason, type SlaRisk } from '@shared/engines/controlTower'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDuration } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { DemoData } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useErpSession } from './useErpSession'

export function reasonText(t: TFunction, data: DemoData, r: RiskReason): string {
  switch (r.code) {
    case 'staffLoad':
      return t('erp06.r.staffLoad', { name: data.fieldStaff[r.staffId]?.name ?? '', n: r.pending })
    case 'timeLeft':
      return t('erp06.r.timeLeft', { time: formatDuration(Math.max(0, r.minutes)) })
    case 'partnerScore':
      return t('erp06.r.partnerScore', { score: r.score })
    case 'tripHalt':
      return t('erp06.r.tripHalt', { time: formatDuration(r.minutes) })
    case 'notAccepted':
      return t(`erp06.r.${r.status === 'flagged' ? 'flagged' : 'notAccepted'}`)
  }
}

export default function ERP06AtRisk() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const risks = useMemo(() => slaRisks(data, now), [data, now])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp06.title')}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {t('erp06.subtitle')} <SimulatedTag />
          </span>
        }
        className="mb-0"
      />
      {risks.length === 0 ? (
        <EmptyState title={t('erp06.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table" data-testid="risks">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp06.col.rank')}</th>
                <th>{t('erp06.col.leg')}</th>
                <th className="text-right">{t('erp06.col.risk')}</th>
                <th className="pl-4">{t('erp06.col.why')}</th>
                <th className="pr-4">{t('erp06.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <Row key={r.legId} r={r} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ r, rank }: { r: SlaRisk; rank: number }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [confirm, setConfirm] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const leg = data.legs[r.legId]
  const label = r.action.kind === 'reassign' ? t('erp06.a.reassign', { partner: data.partners[r.action.partnerId].shortName }) : t(`erp06.a.${r.action.kind}`)
  const canAct = user.role === 'controlTower' || user.role === 'superAdmin'
  return (
    <tr className="border-b align-top last:border-0" aria-label={`${r.shipmentId} L${leg.seq}`}>
      <td className="tabular px-4 py-2 font-semibold">{rank}</td>
      <td className="py-2">
        <Link to={`/erp/shipments/${r.shipmentId}`} className="tabular font-medium text-primary hover:underline">
          {r.shipmentId}
        </Link>{' '}
        · L{leg.seq}
        <span className="block text-caption text-muted-foreground">
          {t(`legType.${leg.type}`)} · {data.partners[leg.partnerId].shortName}
        </span>
      </td>
      <td className="py-2 text-right">
        <span className={cn('tabular font-semibold', r.risk >= 60 ? 'text-status-danger' : r.risk >= 30 ? 'text-status-warning' : 'text-muted-foreground')}>{r.risk}%</span>
      </td>
      <td className="py-2 pl-4">
        <span className="flex items-start gap-1">
          <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden /> {r.reasons.map((x) => reasonText(t, data, x)).join('; ')}
        </span>
      </td>
      <td className="py-2 pr-4">
        {dismissing ? (
          <div className="flex min-w-64 gap-1">
            <Input aria-label={t('erp06.dismissReason')} placeholder={t('erp06.dismissReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" disabled={!reason.trim()} onClick={() => (useDemoStore.getState().dismissRisk(r.legId, reason, user.id), toast.success(t('erp06.dismissed')))}>
              {t('erp06.dismiss')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" disabled={!canAct} onClick={() => setConfirm(true)}>
              {label}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canAct} onClick={() => setDismissing(true)}>
              {t('erp06.dismiss')}
            </Button>
          </div>
        )}
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={label}
          body={t('erp06.confirmBody', { lr: r.shipmentId, risk: r.risk })}
          confirmLabel={t('erp06.apply')}
          onConfirm={() => {
            useDemoStore.getState().applyRiskSuggestion(r.legId, user.id)
            toast.success(t('erp06.applied'))
          }}
        />
      </td>
    </tr>
  )
}
