/**
 * ERP-13 Partner commercials and agreement — docs/04-erp-control-tower.md.
 * Source §4 Phase 3 Step 5: rate card per leg and lane with the AI margin
 * check, hand-over cut-offs, SLA, penalties, liability cap, payment cycle,
 * optional deposit; agreement issued for e-sign; after signature the rate card
 * is in the rate engine. Lines below target margin need Pricing approval
 * (maker-checker, assumed); unapproved ones go out as "not accepted".
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { partnerLineMargin } from '@shared/engines/rateCardMargin'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { LegType, PartnerAgreement, PartnerApplication, PenaltyKind } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { paymentCycle, useLineLabel, useRateText } from '@shared/ui/PartnerOnboardingBits'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const PENALTIES: PenaltyKind[] = ['missedPickup', 'lateArrival', 'lateDelivery', 'missedScan', 'lateTicket']

export default function ERP13Commercials() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  const queue = Object.values(data.applications)
    .filter((a) => a.status === 'agreement' || a.agreement)
    .sort((a, b) => Number(!!b.agreement?.lines.some((l) => l.counter)) - Number(!!a.agreement?.lines.some((l) => l.counter)) || Number(b.status === 'agreement') - Number(a.status === 'agreement'))
  const selected = data.applications[params.get('app') ?? ''] ?? queue[0]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp13.title')} subtitle={t('erp13.subtitle', { count: queue.filter((a) => a.status === 'agreement' || a.agreement?.lines.some((l) => l.counter)).length })} className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <ul className="flex flex-col gap-2" aria-label={t('erp13.queue')}>
          {queue.map((a) => {
            const p = data.partners[a.partnerId]
            const counters = a.agreement?.lines.filter((l) => l.counter).length ?? 0
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setParams({ app: a.id })}
                  aria-current={selected?.id === a.id ? 'true' : undefined}
                  className={cn('flex w-full flex-col gap-1 rounded-lg border bg-card p-3 text-left hover:border-primary', selected?.id === a.id && 'border-primary bg-primary-soft')}
                >
                  <span className="font-medium">{p.shortName}</span>
                  <span className="text-caption text-muted-foreground">
                    {a.ref} · {t(`erp13.agStatus.${a.agreement?.status ?? 'none'}`)}
                  </span>
                  {counters > 0 && <span className="text-caption font-medium text-status-warning">{t('erp13.counters', { count: counters })}</span>}
                </button>
              </li>
            )
          })}
          {queue.length === 0 && <li className="text-muted-foreground">{t('erp13.empty')}</li>}
        </ul>
        {selected && <Commercials key={selected.id} app={selected} />}
      </div>
    </div>
  )
}

function Commercials({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const p = data.partners[app.partnerId]
  const g = app.agreement
  const maker = user.role === 'partnerManagement'
  if (!g)
    return (
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-card-title">
          {p.name} · {app.ref}
        </h2>
        <p className="text-muted-foreground">{t('erp13.noDraft')}</p>
        <Button className="self-start" disabled={!maker} onClick={() => useDemoStore.getState().draftPartnerAgreement(app.id, user.id)}>
          {t('erp13.draft')}
        </Button>
      </section>
    )
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-card-title">
            {p.name} · {app.ref}
          </h2>
          <Chip tone={g.status === 'signed' ? 'success' : g.status === 'negotiation' ? 'warning' : 'info'} bold>
            {t(`erp13.agStatus.${g.status}`)}
          </Chip>
        </div>
        {g.signed && <p className="text-caption text-muted-foreground">{t('erp13.signed', { at: formatDateTime(g.signed.at), count: g.lines.filter((l) => l.status === 'accepted').length })}</p>}
      </section>
      <Lines app={app} g={g} />
      <TermsForm app={app} g={g} editable={maker && g.status !== 'signed'} />
      {maker && g.status !== 'signed' && (
        <Button className="self-start" disabled={g.lines.some((l) => l.counter)} onClick={() => (useDemoStore.getState().issuePartnerAgreement(app.id, user.id), toast.success(t('erp13.issued')))}>
          {g.status === 'draft' ? t('erp13.issue') : t('erp13.reissue')}
        </Button>
      )}
    </div>
  )
}

function Lines({ app, g }: { app: PartnerApplication; g: PartnerAgreement }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const label = useLineLabel()
  const rateText = useRateText()
  const margins = useMemo(() => Object.fromEntries(g.lines.map((l) => [l.id, partnerLineMargin(data, app.partnerId, l)])), [data, app.partnerId, g.lines])
  const maker = user.role === 'partnerManagement'
  const target = data.settings.targetMarginPct
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ln-h">
      <h3 id="ln-h" className="mb-2 font-semibold">
        {t('erp13.lines')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-table [&_td]:pr-4 [&_th]:pr-4" data-testid="agreement-lines">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('erp13.col.line')}</th>
              <th>{t('erp13.col.rate')}</th>
              <th>{t('erp13.col.counter')}</th>
              <th>{t('erp13.col.margin', { target })}</th>
              <th>{t('erp13.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {g.lines.map((l) => {
              const m = margins[l.id]
              const editable = maker && (g.status !== 'signed' || l.status === 'notAccepted')
              return (
                <tr key={l.id} className="border-b align-top last:border-0" aria-label={label(l)}>
                  <td className="py-2">
                    {t(`legType.${l.leg}`)} · {label(l)}
                    <span className="block text-caption text-muted-foreground">{l.serviceKind === 'parcel' ? t('service.parcel') : t('pp08.ptl')}</span>
                  </td>
                  <td className="py-2">
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={t('erp13.rateFor', { line: label(l) })}
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24"
                          value={l.rate}
                          onChange={(e) => useDemoStore.getState().editAgreementLine(app.id, l.id, { rate: Number(e.target.value) })}
                        />
                        <span className="text-caption text-muted-foreground">{rateText(l).replace(/^₹[\d,.]+\s*/, '')}</span>
                      </div>
                    ) : (
                      <span className="tabular">{rateText(l)}</span>
                    )}
                  </td>
                  <td className="py-2">
                    {l.counter ? (
                      <div className="flex flex-col gap-1">
                        <span className="tabular font-semibold">{formatINR(l.counter.rate)}</span>
                        {l.counter.remark && <span className="text-caption text-muted-foreground">{l.counter.remark}</span>}
                        {maker && (
                          <span className="flex gap-1">
                            <Button size="sm" onClick={() => useDemoStore.getState().answerCounter(app.id, l.id, true, user.id)}>
                              {t('erp13.acceptCounter')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => useDemoStore.getState().answerCounter(app.id, l.id, false, user.id)}>
                              {t('erp13.declineCounter')}
                            </Button>
                          </span>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2" data-testid={`margin-${l.id}`}>
                    {!m ? (
                      <Chip tone="neutral">{t('erp13.noCheck')}</Chip>
                    ) : !m.belowTarget ? (
                      <Chip tone="success">{t('erp13.marginOk', { pct: m.marginPct.toFixed(1) })}</Chip>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Chip tone={m.marginPct < 0 ? 'danger' : 'warning'}>{t('erp13.marginBelow', { pct: m.marginPct.toFixed(1) })}</Chip>
                        {l.pricingApproval ? (
                          <span className="text-caption text-status-success">{t('erp13.approvedBy', { name: l.pricingApproval.by === 'system' ? t('erp11.system') : (data.staff[l.pricingApproval.by]?.name ?? '') })}</span>
                        ) : user.role === 'pricing' ? (
                          <Button size="sm" variant="outline" onClick={() => useDemoStore.getState().approveLineBelowTarget(app.id, l.id, user.id)}>
                            {t('erp13.approve')}
                          </Button>
                        ) : (
                          <span className="text-caption text-muted-foreground">{t('erp13.needsPricing')}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2">{g.status === 'draft' ? '—' : <Chip tone={l.status === 'accepted' ? 'success' : 'warning'}>{t(`erp13.line.${l.status}`)}</Chip>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TermsForm({ app, g, editable }: { app: PartnerApplication; g: PartnerAgreement; editable: boolean }) {
  const { t } = useTranslation()
  const p = useData((d) => d.partners[app.partnerId])
  const [deposit, setDeposit] = useState(g.deposit ? String(g.deposit) : '')
  const edit = (x: Partial<Omit<PartnerAgreement, 'lines' | 'status'>>) => useDemoStore.getState().editAgreementTerms(app.id, x)
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card md:grid-cols-2" aria-labelledby="tm-h">
      <h3 id="tm-h" className="font-semibold md:col-span-2">
        {t('erp13.terms')}
      </h3>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-caption font-semibold text-muted-foreground">{t('pp08.handover')}</legend>
        {p.legs.map((leg: LegType) => (
          <Field key={leg} label={t(`legType.${leg}`)} htmlFor={`co-${leg}`} small>
            <Input id={`co-${leg}`} type="time" disabled={!editable} value={g.cutoffs[leg] ?? ''} onChange={(e) => edit({ cutoffs: { ...g.cutoffs, [leg]: e.target.value } })} className="w-32" />
          </Field>
        ))}
        <Field label={t('erp13.ticketAck')} htmlFor="co-tk" small>
          <Input id="co-tk" type="number" min={1} disabled={!editable} value={g.ticketAckHours} onChange={(e) => edit({ ticketAckHours: Number(e.target.value) })} className="w-24" />
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-caption font-semibold text-muted-foreground">{t('pp08.penalties')}</legend>
        {PENALTIES.map((k) => (
          <Field key={k} label={t(`ponb.penalty.${k}`)} htmlFor={`pn-${k}`} small>
            <Input id={`pn-${k}`} type="number" min={0} disabled={!editable} value={g.penalties[k]} onChange={(e) => edit({ penalties: { ...g.penalties, [k]: Number(e.target.value) } })} className="w-28" />
          </Field>
        ))}
      </fieldset>
      <Field label={t('erp13.liabilityPerKg')} htmlFor="li-kg" small>
        <Input id="li-kg" type="number" min={0} disabled={!editable} value={g.liabilityPerKg} onChange={(e) => edit({ liabilityPerKg: Number(e.target.value) })} className="w-28" />
      </Field>
      <Field label={t('erp13.liabilityMax')} htmlFor="li-max" small>
        <Input id="li-max" type="number" min={0} disabled={!editable} value={g.liabilityMax} onChange={(e) => edit({ liabilityMax: Number(e.target.value) })} className="w-32" />
      </Field>
      <Field label={t('pp08.deposit')} htmlFor="dep" small hint={t('erp13.depositHint')}>
        <Input id="dep" type="number" min={0} disabled={!editable} value={deposit} onChange={(e) => (setDeposit(e.target.value), edit({ deposit: Number(e.target.value) || undefined }))} className="w-32" />
      </Field>
      <Field label={t('pp08.paymentCycle')} small>
        <span>{t(`ponb.cycle.${paymentCycle(p.tier ?? 'bronze')}`, { tier: t(`tier.${p.tier ?? 'bronze'}`) })}</span>
      </Field>
    </section>
  )
}
