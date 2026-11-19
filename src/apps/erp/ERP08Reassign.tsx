/**
 * ERP-08 Reassign leg (manual override) — docs/04-erp-control-tower.md §6.3.
 * Source §8 "Manual Override: Control Tower can override any leg"; §10 Step 3
 * "Pickup missed → reassign to backup first-mile partner". The engine's ranking
 * is shown; the operator picks, gives a reason and chooses who is told.
 */
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { canReassign, reassignOptions } from '@shared/engines/controlTower'
import { useData } from '@shared/hooks/useDemo'
import { formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { ReassignReason } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { TierBadge } from '@shared/ui/TierBadge'
import { useErpSession } from './useErpSession'

const REASONS: ReassignReason[] = ['slaRisk', 'partnerRequest', 'capacity', 'quality', 'customerRequest', 'other']

export default function ERP08Reassign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { legId = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const leg = data.legs[legId]
  const options = leg ? reassignOptions(data, legId) : []
  const [partnerId, setPartnerId] = useState(params.get('to') ?? options.find((o) => !o.current && o.eligible)?.partnerId ?? '')
  const [reason, setReason] = useState<ReassignReason>((params.get('reason') as ReassignReason) ?? 'slaRisk')
  const [notify, setNotify] = useState({ oldPartner: true, newPartner: true, customer: true })
  const [confirm, setConfirm] = useState(false)
  if (!leg) return <NotFound />
  const s = data.shipments[leg.shipmentId]
  const current = data.partners[leg.partnerId]
  const allowed = canReassign(leg)
  const canAct = user.role === 'controlTower' || user.role === 'superAdmin'
  const chosen = options.find((o) => o.partnerId === partnerId)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('erp08.back')}
      </button>
      <PageHeader title={t('erp08.title')} className="mb-0" />
      <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2" aria-label={t('erp08.leg')}>
        <div>
          <p className="text-caption text-muted-foreground">{t('erp08.leg')}</p>
          <p className="font-semibold">
            <Link to={`/erp/shipments/${s.id}`} className="tabular text-primary hover:underline">
              {s.id}
            </Link>{' '}
            · L{leg.seq} {t(`legType.${leg.type}`)}
          </p>
          <p className="text-caption text-muted-foreground">{t(`status.leg.${leg.status}`)}</p>
        </div>
        <div>
          <p className="text-caption text-muted-foreground">{t('erp08.current')}</p>
          <p className="flex items-center gap-2 font-semibold" data-testid="current-partner">
            {current.name} <TierBadge tier={current.tier} score={current.score} /> · {formatINR(leg.cost)}
          </p>
        </div>
      </section>

      {!allowed ? (
        <p className="rounded-xl border bg-status-warning-bg p-5 text-status-warning" role="alert">
          {t('erp08.underWay')}
        </p>
      ) : (
        <>
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="opt-h">
            <h2 id="opt-h" className="mb-2 font-semibold">
              {t('erp08.eligible')}
            </h2>
            <RadioGroup value={partnerId} onValueChange={setPartnerId} aria-label={t('erp08.newPartner')}>
              <table className="w-full text-table" data-testid="options">
                <thead>
                  <tr className="border-b text-left text-caption text-muted-foreground">
                    <th className="py-2" />
                    <th>{t('erp08.col.partner')}</th>
                    <th className="text-right">{t('erp08.col.cost')}</th>
                    <th className="text-right">{t('erp08.col.diff')}</th>
                    <th className="text-right">{t('erp08.col.capacity')}</th>
                    <th className="pl-4" />
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => {
                    const p = data.partners[o.partnerId]
                    const pickable = !o.current && o.eligible
                    return (
                      <tr key={o.partnerId} className={cn('border-b last:border-0', !pickable && 'text-muted-foreground')} aria-label={p.shortName}>
                        <td className="py-2 pr-2">{pickable && <RadioGroupItem value={o.partnerId} aria-label={p.shortName} />}</td>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            {p.shortName} <TierBadge tier={p.tier} score={p.score} />
                          </span>
                        </td>
                        <td className="tabular text-right">{formatINR(o.cost)}</td>
                        <td className={cn('tabular text-right', o.costDiff < 0 ? 'text-status-success' : o.costDiff > 0 ? 'text-status-danger' : '')}>{o.current ? '—' : `${o.costDiff > 0 ? '+' : ''}${formatINR(o.costDiff)}`}</td>
                        <td className="tabular text-right">{o.capacityLeft > 0 ? t('erp08.capLeft', { n: o.capacityLeft }) : t('erp08.capFull')}</td>
                        <td className="pl-4">{o.current ? t('erp08.isCurrent') : o.eligible ? '' : t(`erp03.ai.skip.${o.reason}`, { defaultValue: o.reason })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </RadioGroup>
          </section>

          <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
            <Field label={t('erp08.reason')} htmlFor="e08-reason" required>
              <NativeSelect id="e08-reason" value={reason} onChange={(e) => setReason(e.target.value as ReassignReason)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`erp08.reasons.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-body font-medium">{t('erp08.notify')}</legend>
              {(['oldPartner', 'newPartner', 'customer'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <Checkbox checked={notify[k]} onCheckedChange={(v) => setNotify({ ...notify, [k]: v === true })} /> {t(`erp08.notifyWho.${k}`)}
                </label>
              ))}
            </fieldset>
            <Button className="self-start" disabled={!chosen || chosen.current || !canAct} onClick={() => setConfirm(true)}>
              {t('erp08.reassign')}
            </Button>
            {!canAct && <p className="text-caption text-muted-foreground">{t('erp08.ctOnly')}</p>}
          </section>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={t('erp08.confirmTitle', { from: current.shortName, to: chosen ? data.partners[chosen.partnerId].shortName : '' })}
            body={chosen ? t('erp08.confirmBody', { cost: formatINR(chosen.cost) }) : ''}
            confirmLabel={t('erp08.reassign')}
            onConfirm={() => {
              useDemoStore.getState().reassignLeg({ legId: leg.id, partnerId, reason, notify }, user.id)
              toast.success(t('erp08.done', { partner: data.partners[partnerId].shortName }))
              navigate(`/erp/shipments/${s.id}`)
            }}
          />
        </>
      )}
    </div>
  )
}
