/**
 * ERP-20 Leg rules, cut-offs and assignment settings — docs/04-erp-control-tower.md.
 * Source §8: leg planning (first mile → origin hub → line-haul → destination
 * hub → last mile; cut-offs and hand-over windows aligned so legs connect) and
 * the assignment rules (serviceability, service tier, capacity; score → cost →
 * transit). Time changes need a second person's approval and apply to new
 * bookings. The line-haul departure is set per lane (ERP-19).
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { SettingsChange } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

type TimeKey = keyof SettingsChange['changes']
const TIMES: TimeKey[] = ['pickupCutoff', 'intraRegionHubBy', 'lineHaulArrival', 'destHubHandoverBy']
const PATTERNS = [
  { key: 'intraCity', legs: ['firstMile', 'lastMile'] },
  { key: 'intraRegion', legs: ['firstMile', 'originHub', 'lastMile'] },
  { key: 'longHaul', legs: ['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile'] },
] as const
const CHECKER_ROLES = ['leadership', 'superAdmin']

export default function ERP20LegRules() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [times, setTimes] = useState<Record<TimeKey, string>>(() => Object.fromEntries(TIMES.map((k) => [k, data.settings[k]])) as Record<TimeKey, string>)
  const [reason, setReason] = useState('')
  const pending = Object.values(data.settingsChanges).find((c) => c.status === 'pending')
  const history = Object.values(data.settingsChanges)
    .filter((c) => c.status !== 'pending')
    .sort((a, b) => b.at.localeCompare(a.at))
  const changed = TIMES.some((k) => times[k] !== data.settings[k])
  const canEdit = ['networkPlanning', 'superAdmin'].includes(user.role)

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader title={t('erp20.title')} subtitle={t('erp20.subtitle')} className="mb-0" />

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp20.patterns')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('erp20.patterns')}</h2>
        <ul className="flex flex-col gap-2" data-testid="patterns">
          {PATTERNS.map((p) => (
            <li key={p.key}>
              <span className="font-medium">{t(`erp20.p.${p.key}`, { count: p.legs.length })}</span>
              <span className="block text-caption text-muted-foreground">{p.legs.map((l) => t(`legType.${l}`)).join(' → ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp20.windows')}>
        <h2 className="font-heading text-section font-semibold">{t('erp20.windows')}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {TIMES.map((k) => (
            <Field key={k} label={t(`erp20.t.${k}`)} htmlFor={`lr-${k}`} hint={t(`erp20.h.${k}`)}>
              <Input id={`lr-${k}`} type="time" className="tabular" value={times[k]} disabled={!canEdit || !!pending} onChange={(e) => setTimes({ ...times, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">{t('erp20.departureNote')}</p>
        {canEdit && !pending && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('erp20.reason')} htmlFor="lr-reason" className="min-w-72 flex-1">
              <Input id="lr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button
              disabled={!changed || !reason.trim()}
              onClick={() => {
                const id = useDemoStore.getState().proposeSettings(Object.fromEntries(TIMES.map((k) => [k, times[k]])), reason, user.id)
                if (id) {
                  toast.success(t('erp20.proposed', { id }))
                  setReason('')
                }
              }}
            >
              {t('erp20.submit')}
            </Button>
          </div>
        )}
        {pending && <Pending change={pending} isChecker={CHECKER_ROLES.includes(user.role) && pending.by !== user.id} by={user.id} />}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp20.engine')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('erp20.engine')}</h2>
        <dl className="grid gap-x-6 gap-y-2 text-table sm:grid-cols-[14rem_1fr]">
          <dt className="font-medium">{t('erp20.eligibility')}</dt>
          <dd>{t('erp20.eligibilityValue')}</dd>
          <dt className="font-medium">{t('erp20.sort')}</dt>
          <dd>{t('erp20.sortValue')}</dd>
          <dt className="font-medium">{t('erp20.auto')}</dt>
          <dd>
            <Chip tone="success">{t('erp20.on')}</Chip> <span className="text-caption text-muted-foreground">{t('erp20.autoNote')}</span>
          </dd>
          <dt className="font-medium">{t('erp20.tiers')}</dt>
          <dd>{t('erp20.tiersValue', { cut: data.settings.probationVolumeCutPct })}</dd>
        </dl>
      </section>

      {history.length > 0 && (
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp20.history')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp20.history')}</h2>
          <ul className="flex flex-col gap-1 text-table">
            {history.map((c) => (
              <li key={c.id}>
                <span className="tabular">{c.id}</span> · {describe(t, c)} · {c.reason} ·{' '}
                <Chip tone={c.status === 'approved' ? 'success' : 'neutral'}>{t(`erp20.status.${c.status}`)}</Chip> {data.staff[c.checkerId!]?.name}, {formatDateTime(c.decidedAt!)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const describe = (t: TFunction, c: SettingsChange) =>
  Object.entries(c.changes)
    .map(([k, v]) => `${t(`erp20.t.${k}`)} ${v}`)
    .join(', ')

function Pending({ change: c, isChecker, by }: { change: SettingsChange; isChecker: boolean; by: string }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-status-warning bg-status-warning-bg p-3" data-testid="pending-change">
      <p className="flex-1">
        <span className="font-semibold">{t('erp20.pending', { id: c.id })}</span> {describe(t, c)} · {c.reason}
        <span className="block text-caption text-muted-foreground">{t('erp20.proposedBy', { name: data.staff[c.by]?.name ?? c.by, at: formatDateTime(c.at) })}</span>
      </p>
      {isChecker ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => (useDemoStore.getState().decideSettings(c.id, true, by), toast.success(t('erp20.approved')))}>
            {t('erp20.approve')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => (useDemoStore.getState().decideSettings(c.id, false, by), toast.success(t('erp20.rejected')))}>
            {t('erp20.reject')}
          </Button>
        </div>
      ) : (
        <span className="text-caption font-medium">{t('erp20.waiting')}</span>
      )}
    </div>
  )
}
