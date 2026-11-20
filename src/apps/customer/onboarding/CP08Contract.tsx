/**
 * CP-08 Rate card, SLA and contract — docs/01-customer-portal.md §6.1.
 * Source §6 Step 5: standard or negotiated rate card; SLA; ODA list;
 * appointment rules; liability and insurance terms; contract generated and
 * e-signed. Assisted tracks get the contract from their account manager
 * (ERP-27) and can request changes; self-serve accepts the standard card.
 * SIMULATED: Aadhaar OTP e-sign (123456) and DSC token.
 */
import { ArrowRight, Clock, Download, FileSignature, MessageSquare, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { assisted } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { DEMO_LOGIN_OTP, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import type { Customer, CustomerRateCard, DemoData, ParcelTier, ParcelZone } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PrintArea } from '@shared/ui/PrintArea'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

const ZONES: ParcelZone[] = ['A', 'B', 'C', 'D', 'E']
const TIERS: ParcelTier[] = ['economy', 'standard', 'express']

export default function CP08Contract() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer: c } = useCustomerSession()
  const data = useData((d) => d)
  const k = c.onboarding?.contract
  const selfServe = !assisted(c.track)
  const card = data.rateCards[k?.rateCardId ?? (selfServe ? 'RC-STANDARD' : '')]
  const [agree, setAgree] = useState(false)
  const [method, setMethod] = useState<'aadhaarOtp' | 'dsc'>('aadhaarOtp')
  const [otpOpen, setOtpOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [changesOpen, setChangesOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done, { once: true })
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  const signed = k?.status === 'signed'
  const sign = (m: 'aadhaarOtp' | 'dsc' | 'clickWrap') => {
    useDemoStore.getState().signContract(c.id, m, user.id)
    setOtpOpen(false)
    toast.success(t('cp08.signed'))
  }

  const header = (
    <>
      <OnboardingSteps customer={c} current="contract" />
      <PageHeader title={t('cp08.title')} subtitle={selfServe ? t('cp08.subtitleSelf') : t('cp08.subtitleAssisted')} />
    </>
  )

  if (!card || (!k && !selfServe)) {
    return (
      <div className="max-w-5xl">
        {header}
        <p className="flex items-center gap-2 rounded-xl border bg-card p-6" role="status">
          <Clock className="size-5 text-primary" aria-hidden /> {t('cp08.preparing', { name: c.kamId ? data.staff[c.kamId]?.name : '' })}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      {header}
      {signed && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-status-success bg-status-success-bg p-4">
          <FileSignature className="size-6 text-status-success" aria-hidden />
          <span className="font-semibold">{t('cp08.signedOn', { at: formatDateTime(k!.signedAt!), method: t(`cp08.method.${k!.method}`) })}</span>
          <Button size="sm" className="ml-auto" onClick={() => navigate('/customer/onboarding/integration')}>
            {t('cp08.toIntegration')} <ArrowRight />
          </Button>
        </div>
      )}
      {k?.status === 'changesRequested' && (
        <p role="status" className="mb-4 rounded-xl border-2 border-status-warning bg-status-warning-bg p-4 font-medium">
          {t('cp08.changesSent', { name: c.kamId ? data.staff[c.kamId]?.name : '' })}
        </p>
      )}

      <Tabs defaultValue="parcel">
        <TabsList>
          <TabsTrigger value="parcel">{t('cp08.tab.parcel')}</TabsTrigger>
          <TabsTrigger value="ptl">{t('cp08.tab.ptl')}</TabsTrigger>
          <TabsTrigger value="surcharges">{t('cp08.tab.surcharges')}</TabsTrigger>
          <TabsTrigger value="contract">{t('cp08.tab.contract')}</TabsTrigger>
        </TabsList>
        <p className="mt-2 text-caption text-muted-foreground">
          {card.name} · {t('cp08.valid', { from: formatDate(card.validFrom), to: formatDate(card.validTo) })}
        </p>

        <TabsContent value="parcel">
          <ParcelTable card={card} />
        </TabsContent>
        <TabsContent value="ptl">
          <PtlTable data={data} card={card} />
        </TabsContent>
        <TabsContent value="surcharges">
          <Surcharges data={data} card={card} />
        </TabsContent>

        <TabsContent value="contract" className="flex flex-col gap-4">
          <section className="max-h-[480px] overflow-y-auto rounded-xl border bg-card p-6 shadow-card" aria-label={t('cp08.preview')}>
            <ContractDoc data={data} c={c} card={card} />
          </section>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrinting(true)}>
              <Printer /> {t('cp08.download')}
            </Button>
            {!selfServe && !signed && (
              <Button variant="outline" size="sm" disabled={!isAdmin || k?.status === 'changesRequested'} onClick={() => setChangesOpen(true)}>
                <MessageSquare /> {t('cp08.requestChanges')}
              </Button>
            )}
          </div>
          {!signed && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-card">
              <label className="flex items-start gap-2">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                <span>{selfServe ? t('cp08.clickWrap') : t('cp08.agree')}</span>
              </label>
              {!selfServe && (
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as 'aadhaarOtp' | 'dsc')} className="flex flex-wrap gap-4" aria-label={t('cp08.methodLabel')}>
                  {(['aadhaarOtp', 'dsc'] as const).map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <RadioGroupItem value={m} /> {t(`cp08.method.${m}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
              <Button className="self-start" disabled={!agree || !isAdmin || k?.status === 'changesRequested'} onClick={() => (selfServe ? sign('clickWrap') : method === 'dsc' ? sign('dsc') : setOtpOpen(true))}>
                <FileSignature /> {selfServe ? t('cp08.accept') : t('cp08.acceptSign')}
              </Button>
              {!isAdmin && <p className="text-caption text-muted-foreground">{t('cp08.adminOnly')}</p>}
            </section>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cp08.esignTitle')}</DialogTitle>
          </DialogHeader>
          <p>{t('cp08.esignBody', { name: c.signatory?.name ?? c.onboarding?.kyc?.signatory?.name ?? '' })}</p>
          <Field label={t('cp08.otp')} htmlFor="es-otp" hint={<>{t('login.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag /></>}>
            <Input id="es-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tabular" />
          </Field>
          <Button disabled={!verifyLoginOtp(otp)} onClick={() => sign('aadhaarOtp')}>
            {t('cp08.signNow')}
          </Button>
        </DialogContent>
      </Dialog>

      <ChangesDialog open={changesOpen} onOpenChange={setChangesOpen} c={c} card={card} by={user.id} />
      {printing && (
        <PrintArea>
          <div className="p-8">
            <ContractDoc data={data} c={c} card={card} />
          </div>
        </PrintArea>
      )}
    </div>
  )
}

export function ParcelTable({ card }: { card: CustomerRateCard }) {
  const { t } = useTranslation()
  return (
    <section className="overflow-x-auto rounded-xl border bg-card p-4 shadow-card">
      <table className="w-full text-table" data-testid="parcel-card">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="py-2">{t('cp08.zone')}</th>
            {TIERS.map((tier) => (
              <th key={tier}>{t(`service.${tier}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONES.filter((z) => card.parcel[z]).map((z) => (
            <tr key={z} className="border-b last:border-0">
              <td className="py-2">
                <span className="font-semibold">{z}</span> {t(`cp08.zoneName.${z}`)}
              </td>
              {TIERS.map((tier) => (
                <td key={tier} className="tabular">
                  {formatINR(card.parcel[z][tier].first)} + {formatINR(card.parcel[z][tier].additional)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-muted-foreground">{t('cp08.parcelNote')}</p>
    </section>
  )
}

export function PtlTable({ data, card }: { data: DemoData; card: CustomerRateCard }) {
  const { t } = useTranslation()
  return (
    <section className="overflow-x-auto rounded-xl border bg-card p-4 shadow-card">
      <table className="w-full text-table">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="py-2">{t('cp08.lane')}</th>
            <th>{t('cp08.service')}</th>
            <th className="text-right">{t('cp08.perKg')}</th>
            <th className="text-right">{t('cp08.minKg')}</th>
            <th className="text-right">{t('cp08.cft')}</th>
            <th className="text-right">{t('cp08.transit')}</th>
          </tr>
        </thead>
        <tbody>
          {card.ptl.map((l, i) => {
            const lane = data.lanes[l.laneId]
            return (
              <tr key={i} className="tabular border-b last:border-0">
                <td className="py-2">
                  {lane.originRegion} → {lane.destRegion}
                </td>
                <td>{t(`service.${l.service}`)}</td>
                <td className="text-right">{formatINR(l.perKg)}</td>
                <td className="text-right">{l.minKg} kg</td>
                <td className="text-right">{l.cftFactor}</td>
                <td className="text-right">{t('cp08.days', { count: lane.transitDays[l.service] })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export function Surcharges({ data, card }: { data: DemoData; card: CustomerRateCard }) {
  const { t } = useTranslation()
  const s = card.surcharges
  const rows: [string, string][] = [
    [t('cp08.s.fuel'), `${s.fuelPct}%`],
    [t('cp08.s.oda'), t('cp08.s.odaValue', { perKg: formatINR(s.odaPerKg), min: formatINR(s.odaMin) })],
    [t('cp08.s.docket'), t('cp08.s.docketValue', { ptl: formatINR(s.docketPtl), parcel: formatINR(s.docketParcel) })],
    [t('cp08.s.appointment'), formatINR(s.appointment)],
    [t('cp08.s.cod'), t('cp08.s.codValue', { pct: s.codPct, min: formatINR(s.codMin) })],
    [t('cp08.s.toPay'), formatINR(s.toPayFee)],
    [t('cp08.s.fov'), t('cp08.s.fovValue', { pct: s.fovPct })],
    [t('cp08.s.special'), formatINR(s.specialHandlingPerPiece)],
    [t('cp08.s.cutoff'), data.settings.pickupCutoff],
    [t('cp08.s.liability'), t('cp08.s.liabilityValue', { perKg: formatINR(s.liabilityPerKg), max: formatINR(s.liabilityMax) })],
  ]
  const downloadOda = () => {
    const oda = Object.values(data.pincodes)
      .filter((p) => p.oda)
      .map((p) => ({ Pincode: p.code, Area: p.area, City: p.city, State: p.state }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(oda), 'ODA')
    XLSX.writeFile(book, 'oda_list.xlsx')
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="surcharges">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b py-1">
            <dt>{k}</dt>
            <dd className="tabular font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-muted-foreground">{t('cp08.appointmentRule')}</p>
      <Button variant="outline" size="sm" className="self-start" onClick={downloadOda}>
        <Download /> {t('cp08.odaList')}
      </Button>
    </section>
  )
}

/** The contract generated from the template with this customer's card (source §6 Step 5). */
function ContractDoc({ data, c, card }: { data: DemoData; c: Customer; card: CustomerRateCard }) {
  const { t } = useTranslation()
  const k = c.onboarding?.contract
  const sig = c.signatory ?? c.onboarding?.kyc?.signatory
  const s = card.surcharges
  return (
    <article className="flex flex-col gap-3 text-body">
      <h2 className="text-section">{t('cp08.doc.title')}</h2>
      <p>{t('cp08.doc.parties', { customer: c.legalName, gstin: c.gstin })}</p>
      <p className="tabular">
        {t('cp08.doc.term', { from: formatDate(k?.effectiveDate ?? card.validFrom), months: k?.termMonths ?? 12 })} · {card.name}
      </p>
      <h3 className="font-semibold">{t('cp08.doc.services')}</h3>
      <p>{t('cp08.doc.servicesBody')}</p>
      <h3 className="font-semibold">{t('cp08.doc.sla')}</h3>
      <p>{t('cp08.doc.slaBody', { cutoff: data.settings.pickupCutoff })}</p>
      <h3 className="font-semibold">{t('cp08.doc.liability')}</h3>
      <p>{t('cp08.doc.liabilityBody', { perKg: formatINR(s.liabilityPerKg), max: formatINR(s.liabilityMax), fov: s.fovPct })}</p>
      <h3 className="font-semibold">{t('cp08.doc.payment')}</h3>
      <p>{c.billing === 'credit' ? t('cp08.doc.credit', { limit: formatINR(c.creditLimit), days: c.creditTermsDays }) : t('cp08.doc.prepaid')}</p>
      <h3 className="font-semibold">{t('cp08.doc.appointment')}</h3>
      <p>{t('cp08.doc.appointmentBody', { fee: formatINR(s.appointment) })}</p>
      <p className="mt-4 border-t pt-3 text-caption text-muted-foreground">
        {t('cp08.doc.signatory', { name: sig?.name ?? '—', designation: sig?.designation ?? '' })}
        {k?.signedAt ? ` · ${t('cp08.doc.signedAt', { at: formatDateTime(k.signedAt) })}` : ''}
      </p>
    </article>
  )
}

function ChangesDialog({ open, onOpenChange, c, card, by }: { open: boolean; onOpenChange: (v: boolean) => void; c: Customer; card: CustomerRateCard; by: string }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const lines = [...card.ptl.map((l) => `${data.lanes[l.laneId].originRegion} → ${data.lanes[l.laneId].destRegion} ${t(`service.${l.service}`)}`), t('cp08.otherTerms')]
  const [line, setLine] = useState(lines[0])
  const [remark, setRemark] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cp08.requestChanges')}</DialogTitle>
        </DialogHeader>
        <Field label={t('cp08.line')} htmlFor="ch-line">
          <NativeSelect id="ch-line" value={line} onChange={(e) => setLine(e.target.value)}>
            {lines.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp08.remark')} htmlFor="ch-remark" required>
          <Input id="ch-remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </Field>
        <Button
          disabled={!remark.trim()}
          onClick={() => {
            useDemoStore.getState().requestContractChanges(c.id, line, remark, by)
            onOpenChange(false)
            toast.success(t('cp08.changesToast'))
          }}
        >
          {t('cp08.send')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
