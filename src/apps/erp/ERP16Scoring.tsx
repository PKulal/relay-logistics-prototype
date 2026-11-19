/**
 * ERP-16 Scorecard run and tier review — docs/04-erp-control-tower.md.
 * Source §5.2 (six KPIs, Parcel / PTL weights), §5.3 (tiers and what happens
 * when the score falls), §4 Step 8 (weekly scorecard, tier reviews).
 * Publishing changes the partner's score (assignment ranking) and tier
 * (payout cycle) at once.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { KPI_KEYS, kpiPct, runnableWeeks, runRows, TIERS, type RunRow } from '@shared/engines/scoring'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatWeek } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Tier } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'
import type { Tone } from '@shared/ui/tones'
import { useErpSession } from './useErpSession'

const RULE_TONE: Record<RunRow['rule'], Tone> = { up: 'success', same: 'neutral', platinumGrace: 'info', platinumDown: 'warning', improvementPlan: 'warning', warning: 'warning', volumeCut: 'danger', suspensionReview: 'danger' }

export default function ERP16Scoring() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const runnable = runnableWeeks(data, now)
  const weeks = [...new Set(Object.values(data.weeklyScores).filter((w) => w.published || runnable.includes(w.week)).map((w) => w.week))].sort().reverse()
  const week = weeks.includes(params.get('week') ?? '') ? params.get('week')! : (runnable[0] ?? weeks[0])
  const rows = runRows(data, week)
  const published = rows.length > 0 && rows.every((r) => r.score.published)
  const [confirm, setConfirm] = useState(false)
  const changes = rows.filter((r) => r.final !== r.current)
  const first = rows[0]?.score

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp16.title')} subtitle={t('erp16.subtitle')} className="mb-0" />
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('erp16.week')} htmlFor="sc-week" className="w-56">
          <NativeSelect id="sc-week" value={week} onChange={(e) => setParams({ week: e.target.value })}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {formatWeek(w)} {runnable.includes(w) ? `· ${t('erp16.toPublish')}` : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="pb-1">
          {published ? (
            <Chip tone="success">{t('erp16.publishedBy', { name: data.staff[first!.publishedBy!]?.name ?? first!.publishedBy, at: formatDateTime(first!.publishedAt!) })}</Chip>
          ) : (
            <Chip tone="warning">{t('erp16.waiting', { count: changes.length })}</Chip>
          )}
        </div>
        {!published && (
          <Button className="ml-auto" onClick={() => setConfirm(true)}>
            {t('erp16.publish')}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="score-run">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp16.col.partner')}</th>
              <th>{t('erp16.col.profile')}</th>
              {KPI_KEYS.map((k) => (
                <th key={k} className="text-right">
                  {t(`kpi.short.${k}`)}
                </th>
              ))}
              <th className="text-right">{t('erp16.col.total')}</th>
              <th>{t('erp16.col.tier')}</th>
              <th>{t('erp16.col.rule')}</th>
              {!published && <th>{t('erp16.col.override')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.score.id} className={cn('border-b align-top last:border-0', r.final !== r.current && 'bg-status-warning-bg/40')} aria-label={r.partner.shortName}>
                <td className="px-4 py-2 font-medium">{r.partner.shortName}</td>
                <td>{t(`kpi.profile.${r.score.profile}`)}</td>
                {KPI_KEYS.map((k) => (
                  <td key={k} className="tabular text-right" title={`${kpiPct(r.score.kpis, k)}%`}>
                    {r.points[k].toFixed(1)}
                  </td>
                ))}
                <td className="tabular text-right font-semibold">{r.score.total.toFixed(1)}</td>
                <td className="whitespace-nowrap">
                  <TierBadge tier={r.current} /> → <TierBadge tier={r.final} />
                  {r.score.override && <span className="block text-caption text-muted-foreground">{t('erp16.overridden', { reason: r.score.override.reason })}</span>}
                </td>
                <td>
                  <Chip tone={RULE_TONE[r.rule]}>{t(`erp16.rule.${r.rule}`)}</Chip>
                  {r.final === 'probation' && (
                    <Link to={`/erp/partners/suspensions?partner=${r.partner.id}`} className="mt-1 block text-caption text-primary hover:underline">
                      {t('erp16.caseLink')}
                    </Link>
                  )}
                </td>
                {!published && (
                  <td className="py-2">
                    <Override row={r} by={user.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {changes.some((r) => r.rule === 'improvementPlan') && (
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp16.plans')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp16.plans')}</h2>
          <ul className="flex flex-col gap-1">
            {changes
              .filter((r) => r.rule === 'improvementPlan')
              .map((r) => (
                <li key={r.partner.id}>{t('erp16.planFor', { partner: r.partner.shortName, coordinator: data.staff[r.partner.coordinatorId ?? '']?.name ?? '—' })}</li>
              ))}
          </ul>
        </section>
      )}
      <p className="text-caption text-muted-foreground">{t('erp16.rules')}</p>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('erp16.confirm', { week: week ? formatWeek(week) : '' })}
        body={t('erp16.confirmBody', { count: rows.length, changes: changes.length })}
        confirmLabel={t('erp16.publish')}
        onConfirm={() => {
          useDemoStore.getState().publishScores(week, user.id)
          toast.success(t('erp16.published', { count: rows.length }))
        }}
      />
    </div>
  )
}

function Override({ row, by }: { row: RunRow; by: string }) {
  const { t } = useTranslation()
  const [tier, setTier] = useState<Tier | ''>(row.score.override?.tier ?? '')
  const [reason, setReason] = useState(row.score.override?.reason ?? '')
  const changed = (tier || undefined) !== row.score.override?.tier || reason !== (row.score.override?.reason ?? '')
  return (
    <div className="flex w-64 flex-col gap-1">
      <NativeSelect aria-label={t('erp16.overrideX', { partner: row.partner.shortName })} value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="h-8">
        <option value="">{t('erp16.asProposed')}</option>
        {TIERS.map((x) => (
          <option key={x} value={x}>
            {t(`tier.${x}`)}
          </option>
        ))}
      </NativeSelect>
      {tier && <Input aria-label={t('erp16.reasonX', { partner: row.partner.shortName })} placeholder={t('erp16.reason')} value={reason} onChange={(e) => setReason(e.target.value)} className="h-8" />}
      {changed && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!tier && !reason.trim()}
          onClick={() => {
            useDemoStore.getState().overrideTier(row.score.id, tier || undefined, reason, by)
            toast.success(t('erp16.overrideSaved'))
          }}
        >
          {t('erp16.saveOverride')}
        </Button>
      )}
    </div>
  )
}
