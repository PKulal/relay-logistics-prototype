/**
 * PP-08 Rate card, SLA and agreement — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 3 Step 5: rate card per leg and lane, hand-over windows and
 * cut-offs, SLA, penalty matrix, liability cap, payment cycle, optional
 * deposit; the AI margin check (the partner sees only "Rate not accepted on
 * this lane"); agreement from template, e-signed; rate card loaded into the
 * rate engine. Self-billing consent: source §9.
 * Left out under the scope rule: rate card Excel / agreement PDF download.
 * SIMULATED: Aadhaar OTP (123456) and DSC e-sign.
 */
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { DEMO_LOGIN_OTP, verifyLoginOtp } from '@shared/sim/otp'
import { simulateLatency } from '@shared/sim/latency'
import { useDemoStore } from '@shared/store'
import type { PartnerAgreement, PartnerApplication, PenaltyKind } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { paymentCycle, useLineLabel, useRateText } from '@shared/ui/PartnerOnboardingBits'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { usePartnerSession } from '../usePartnerSession'
import { PartnerOnboardingSteps, usePartnerApplication } from './steps'

const PENALTIES: PenaltyKind[] = ['missedPickup', 'lateArrival', 'lateDelivery', 'missedScan', 'lateTicket']

export default function PP08Agreement() {
  const { t } = useTranslation()
  const app = usePartnerApplication()
  if (!app) return null
  const g = app.agreement
  const ready = g && g.status !== 'draft'
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader title={t('pp08.title')} subtitle={g?.status ? t(`pp08.status.${g.status}`) : undefined} className="mb-0" />
      <PartnerOnboardingSteps app={app} current="agreement" />
      {!ready ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground" data-testid="preparing">
          {app.status === 'agreement' ? t('pp08.preparing') : t('pp08.notYet')}
        </p>
      ) : (
        <Tabs defaultValue="rates">
          <TabsList>
            <TabsTrigger value="rates">{t('pp08.tab.rates')}</TabsTrigger>
            <TabsTrigger value="terms">{t('pp08.tab.terms')}</TabsTrigger>
            <TabsTrigger value="agreement">{t('pp08.tab.agreement')}</TabsTrigger>
          </TabsList>
          <TabsContent value="rates">
            <RateCard app={app} g={g} />
          </TabsContent>
          <TabsContent value="terms">
            <Terms g={g} />
          </TabsContent>
          <TabsContent value="agreement">
            <Sign app={app} g={g} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function RateCard({ app, g }: { app: PartnerApplication; g: PartnerAgreement }) {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const label = useLineLabel()
  const rateText = useRateText()
  const [prop, setProp] = useState<Record<string, { rate: string; remark: string }>>({})
  const canPropose = (lineStatus: string) => (g.status === 'issued' || (g.status === 'signed' && lineStatus === 'notAccepted')) && user.role === 'admin'
  const counters = Object.entries(prop)
    .filter(([, v]) => Number(v.rate) > 0)
    .map(([lineId, v]) => ({ lineId, rate: Number(v.rate), remark: v.remark }))
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-table [&_td]:pr-4 [&_th]:pr-4" data-testid="rate-lines">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('pp08.col.leg')}</th>
              <th>{t('pp08.col.lane')}</th>
              <th>{t('pp08.col.service')}</th>
              <th>{t('pp08.col.rate')}</th>
              <th>{t('pp08.col.status')}</th>
              <th>{t('pp08.col.proposed')}</th>
            </tr>
          </thead>
          <tbody>
            {g.lines.map((l) => (
              <tr key={l.id} className="border-b align-top last:border-0" aria-label={label(l)}>
                <td className="py-2">{t(`legType.${l.leg}`)}</td>
                <td className="py-2">{label(l)}</td>
                <td className="py-2">{l.serviceKind === 'parcel' ? t('service.parcel') : l.serviceKind === 'ptl' ? t('pp08.ptl') : t('pp08.allServices')}</td>
                <td className="tabular py-2">{rateText(l)}</td>
                <td className="py-2">
                  {l.counter ? (
                    <Chip tone="info">{t('pp08.counterSent', { rate: formatINR(l.counter.rate) })}</Chip>
                  ) : l.status === 'accepted' ? (
                    <Chip tone="success">{t('pp08.accepted')}</Chip>
                  ) : (
                    <Chip tone="warning">{t('pp08.notAccepted')}</Chip>
                  )}
                </td>
                <td className="py-2">
                  {canPropose(l.status) && !l.counter && (
                    <div className="flex min-w-56 flex-col gap-1">
                      <Input aria-label={t('pp08.proposeFor', { lane: label(l) })} type="number" min={0} step="0.01" placeholder="₹" value={prop[l.id]?.rate ?? ''} onChange={(e) => setProp({ ...prop, [l.id]: { remark: prop[l.id]?.remark ?? '', rate: e.target.value } })} />
                      {prop[l.id]?.rate && <Input aria-label={t('pp08.remarkFor', { lane: label(l) })} placeholder={t('pp08.remark')} value={prop[l.id]?.remark ?? ''} onChange={(e) => setProp({ ...prop, [l.id]: { ...prop[l.id], remark: e.target.value } })} />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {g.lines.some((l) => l.status === 'notAccepted' && !l.counter) && <p className="text-caption text-status-warning">{t('pp08.reviseHint')}</p>}
      {(g.status === 'issued' || g.status === 'signed') && (
        <Button
          variant="outline"
          className="self-start"
          disabled={!counters.length}
          onClick={() => (useDemoStore.getState().proposePartnerChanges(app.id, counters, user.id), setProp({}), toast.success(t('pp08.proposed')))}
        >
          {t('pp08.propose')}
        </Button>
      )}
      {g.status === 'negotiation' && <p className="text-muted-foreground">{t('pp08.underNegotiation')}</p>}
    </section>
  )
}

function Terms({ g }: { g: PartnerAgreement }) {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card md:grid-cols-2" data-testid="terms">
      <div>
        <h3 className="mb-2 font-semibold">{t('pp08.handover')}</h3>
        <ul className="flex flex-col gap-1">
          {partner.legs.map((leg) => (
            <li key={leg}>{t(`pp08.cutoff.${leg}`, { time: g.cutoffs[leg] ?? '—' })}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t('pp08.sla')}</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t('pp08.slaPickup')}</li>
          <li>{t('pp08.slaArrival')}</li>
          <li>{t('pp08.slaTicket', { hours: g.ticketAckHours })}</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t('pp08.penalties')}</h3>
        <table className="w-full text-table">
          <tbody>
            {PENALTIES.map((k) => (
              <tr key={k} className="border-b last:border-0">
                <td className="py-1">{t(`ponb.penalty.${k}`)}</td>
                <td className="tabular text-right">{formatINR(g.penalties[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-[10rem_1fr] content-start gap-y-2">
        <dt className="text-muted-foreground">{t('pp08.liability')}</dt>
        <dd>{t('pp08.liabilityText', { perKg: formatINR(g.liabilityPerKg), max: formatINR(g.liabilityMax) })}</dd>
        <dt className="text-muted-foreground">{t('pp08.paymentCycle')}</dt>
        <dd>{t(`ponb.cycle.${paymentCycle(partner.tier ?? 'bronze')}`, { tier: t(`tier.${partner.tier ?? 'bronze'}`) })}</dd>
        <dt className="text-muted-foreground">{t('pp08.deposit')}</dt>
        <dd>{g.deposit ? formatINR(g.deposit) : t('pp08.noDeposit')}</dd>
      </dl>
    </section>
  )
}

function Sign({ app, g }: { app: PartnerApplication; g: PartnerAgreement }) {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const signer = useData((d) => (g.signed ? (d.partnerUsers[g.signed.by]?.name ?? '') : ''))
  const label = useLineLabel()
  const rateText = useRateText()
  const [agree, setAgree] = useState(false)
  const [selfBilling, setSelfBilling] = useState(true)
  const [method, setMethod] = useState<'aadhaarOtp' | 'dsc'>('aadhaarOtp')
  const [otpOpen, setOtpOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const accepted = g.lines.filter((l) => l.status === 'accepted')
  const sign = async () => {
    if (method === 'aadhaarOtp' && !verifyLoginOtp(otp)) return toast.error(t('login.wrongOtp'))
    setBusy(true)
    await simulateLatency(600, 900)
    useDemoStore.getState().signPartnerAgreement(app.id, method, selfBilling, user.id)
    setBusy(false)
    toast.success(t('pp08.signed'))
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div role="region" aria-label={t('pp08.preview')} className="max-h-80 overflow-y-auto rounded-lg border bg-gray-50 p-4 text-table">
        <p className="font-semibold">{t('pp08.doc.title')}</p>
        <p>{t('pp08.doc.parties', { partner: partner.name, gstin: partner.gstin || partner.pan })}</p>
        <p className="mt-2 font-semibold">{t('pp08.doc.rates')}</p>
        <ul className="list-disc pl-5">
          {accepted.map((l) => (
            <li key={l.id}>
              {t(`legType.${l.leg}`)} · {label(l)}: {rateText(l)}
            </li>
          ))}
        </ul>
        <p className="mt-2">{t('pp08.doc.terms', { perKg: formatINR(g.liabilityPerKg), max: formatINR(g.liabilityMax), hours: g.ticketAckHours })}</p>
        <p className="mt-2">{t('pp08.doc.selfBilling')}</p>
      </div>
      {g.status === 'signed' && g.signed ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-semibold text-status-success" data-testid="signed">
            <CheckCircle2 className="size-4" aria-hidden /> {t('pp08.signedOn', { at: formatDateTime(g.signed.at), name: signer, method: t(`pp08.method.${g.signed.method}`) })}
          </p>
          <p className="text-caption text-muted-foreground">{g.signed.selfBilling ? t('pp08.selfBillingOn') : t('pp08.selfBillingOff')}</p>
          {app.status === 'integration' && (
            <Button asChild className="self-start">
              <Link to="/partner/onboarding/setup">{t('pp08.toSetup')}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <label className="flex items-start gap-2">
            <Checkbox checked={selfBilling} onCheckedChange={(v) => setSelfBilling(v === true)} className="mt-0.5" /> {t('pp08.selfBilling')}
          </label>
          <label className="flex items-start gap-2">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" aria-label={t('pp08.agree')} /> {t('pp08.agree')}
          </label>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as 'aadhaarOtp' | 'dsc')} className="flex gap-4" aria-label={t('pp08.methodLabel')}>
            {(['aadhaarOtp', 'dsc'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} /> {t(`pp08.method.${m}`)}
              </label>
            ))}
          </RadioGroup>
          {otpOpen && method === 'aadhaarOtp' && (
            <Field label={t('pp08.otp')} htmlFor="pp08-otp" hint={<>{t('login.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag /></>} className="max-w-xs">
              <Input id="pp08-otp" inputMode="numeric" maxLength={6} className="tabular" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {method === 'aadhaarOtp' && !otpOpen ? (
              <Button disabled={!agree || g.status !== 'issued' || user.role !== 'admin'} onClick={() => setOtpOpen(true)}>
                {t('pp08.acceptSign')}
              </Button>
            ) : (
              <Button disabled={!agree || g.status !== 'issued' || busy || user.role !== 'admin' || (method === 'aadhaarOtp' && otp.length !== 6)} onClick={sign}>
                {busy && <Loader2 className="animate-spin" />} {method === 'dsc' ? t('pp08.signDsc') : t('pp08.sign')}
              </Button>
            )}
          </div>
          {g.status === 'negotiation' && <p className="text-caption text-muted-foreground">{t('pp08.waitCounter')}</p>}
          {user.role !== 'admin' && <p className="text-caption text-muted-foreground">{t('pp08.adminOnly')}</p>}
        </>
      )}
    </section>
  )
}
