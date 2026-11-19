/**
 * ERP-14 Trial monitoring and go-live — docs/04-erp-control-tower.md.
 * Source §4 Phase 5 Steps 7–8: trial jobs with AI anomaly flags, the running
 * score against the pass mark (80); go live (partner joins the assignment pool
 * at Bronze), extend the trial, or decline with reasons.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { trialComplete } from '@shared/store/partnerAgreementActions'
import type { Partner } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { TrialPanel } from '@shared/ui/PartnerOnboardingBits'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { TierBadge } from '@shared/ui/TierBadge'
import { useErpSession } from './useErpSession'

export default function ERP14Trials() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  const list = Object.values(data.partners)
    .filter((p) => p.trial)
    .sort((a, b) => Number(b.status === 'trial') - Number(a.status === 'trial') || a.shortName.localeCompare(b.shortName))
  const selected = data.partners[params.get('partner') ?? ''] ?? list[0]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp14.title')} subtitle={t('erp14.subtitle', { count: list.filter((p) => p.status === 'trial').length })} className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <ul className="flex flex-col gap-2" aria-label={t('erp14.list')}>
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setParams({ partner: p.id })}
                aria-current={selected?.id === p.id ? 'true' : undefined}
                className={cn('flex w-full flex-col gap-1 rounded-lg border bg-card p-3 text-left hover:border-primary', selected?.id === p.id && 'border-primary bg-primary-soft')}
              >
                <span className="font-medium">{p.shortName}</span>
                <span className="text-caption text-muted-foreground">
                  {t('partner.typeShort', { type: p.type })} · {t(`ponb.trial.progress.${p.trial!.unit ?? 'trips'}`, { done: p.trial!.tripsDone, required: p.trial!.tripsRequired })}
                </span>
                <TierBadge tier={p.tier} score={p.trial!.jobs?.length ? p.trial!.score : undefined} className="self-start" />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="text-muted-foreground">{t('erp14.empty')}</li>}
        </ul>
        {selected && <Trial key={selected.id} partner={selected} />}
      </div>
    </div>
  )
}

function Trial({ partner: p }: { partner: Partner }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const pass = useData((d) => d.settings.trialPassMark)
  const decidedBy = useData((d) => (p.trial?.decision ? (p.trial.decision.by === 'system' ? t('erp11.system') : (d.staff[p.trial.decision.by]?.name ?? '')) : ''))
  const complete = trialComplete(p)
  const canLive = complete && p.trial!.score >= pass
  const [d, setD] = useState<'live' | 'extend' | 'decline'>(canLive ? 'live' : 'extend')
  const [reasons, setReasons] = useState('')
  const open = p.status === 'trial'
  const valid = d === 'live' ? canLive : d === 'decline' ? !!reasons.trim() : true
  return (
    <div className="flex flex-col gap-4">
      <TrialPanel partner={p} />
      {p.trial?.decision && (
        <p className="text-caption text-muted-foreground" data-testid="trial-decision">
          {t(`erp14.decided.${p.trial.decision.result}`, { name: decidedBy, at: formatDateTime(p.trial.decision.at) })}
        </p>
      )}
      {open && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dc-h">
          <h3 id="dc-h" className="font-semibold">
            {t('erp14.decision')}
          </h3>
          {!complete && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-caption text-muted-foreground">{t('erp14.notComplete')}</p>
              {/* Demo tooling only for partners with no live work in the demo; Deccan's third trip is the hero trip */}
              {p.trial!.jobs?.some((j) => !j.simulated) ? (
                <p className="text-caption text-muted-foreground">{t('erp14.liveTrips')}</p>
              ) : (
                <Button variant="outline" size="sm" onClick={() => useDemoStore.getState().simulateTrialJob(p.id)}>
                  {t('erp14.simulateJob')} <SimulatedTag />
                </Button>
              )}
            </div>
          )}
          <RadioGroup value={d} onValueChange={(v) => setD(v as typeof d)} className="flex flex-wrap gap-4" aria-label={t('erp14.decision')}>
            {(['live', 'extend', 'decline'] as const).map((k) => (
              <label key={k} className={cn('flex items-center gap-2', k === 'live' && !canLive && 'text-muted-foreground')}>
                <RadioGroupItem value={k} disabled={k === 'live' && !canLive} /> {t(`erp14.d.${k}`)}
              </label>
            ))}
          </RadioGroup>
          {d !== 'live' && (
            <Field label={d === 'decline' ? t('erp14.reasonsRequired') : t('erp14.reasons')} htmlFor="e14-r">
              <Input id="e14-r" value={reasons} onChange={(e) => setReasons(e.target.value)} />
            </Field>
          )}
          <Button
            className="self-start"
            disabled={!valid || user.role !== 'partnerManagement'}
            onClick={() => (useDemoStore.getState().decideTrial(p.id, d, reasons, user.id), toast.success(t(`erp14.done.${d}`, { name: p.shortName })))}
          >
            {t('erp14.confirm')}
          </Button>
          <p className="text-caption text-muted-foreground">{t('erp14.rule', { pass })}</p>
        </section>
      )}
    </div>
  )
}
