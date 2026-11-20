/**
 * CP-33 Company profile — docs/01-customer-portal.md. Source §6 (KYC: GSTIN,
 * PAN, CIN, signatory, bank penny-drop; credit terms), §7.2. Admin edits;
 * Dispatch and Finance view. Legal details change only through a ticket to
 * Logisco. A bank change needs an OTP and a new SIMULATED penny-drop.
 * Tracking-page branding is not built (no basis in the client document).
 */
import { Building2, FileText, Landmark, Loader2, Receipt, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import type { Customer } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { ParcelTable, PtlTable, Surcharges } from './onboarding/CP08Contract'
import { useCustomerSession } from './useCustomerSession'

type Prefs = NonNullable<Customer['billingPrefs']>
type DocKind = NonNullable<Customer['kycDocs']>[number]['kind']

const card = 'rounded-xl border bg-card p-5 shadow-card'

export default function CP33Company() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const c = data.customers[customer.id]
  const isAdmin = user.role === 'admin'
  const kam = c.kamId ? data.staff[c.kamId] : undefined
  const rateCard = data.rateCards[c.rateCardId]
  const [rcOpen, setRcOpen] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const kyc = c.onboarding?.kyc?.status ?? (c.status === 'live' ? 'verified' : 'notStarted')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cp33.title')} subtitle={isAdmin ? t('cp33.subtitle') : t('cp33.viewOnly')} className="mb-0" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-label={t('cp33.legal')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <Building2 className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.legal')}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="legal">
            <dt className="text-muted-foreground">{t('cp33.legalName')}</dt>
            <dd>{c.legalName}</dd>
            <dt className="text-muted-foreground">GSTIN</dt>
            <dd className="tabular">{c.gstin}</dd>
            <dt className="text-muted-foreground">PAN</dt>
            <dd className="tabular">{c.pan}</dd>
            {c.cin && (
              <>
                <dt className="text-muted-foreground">CIN</dt>
                <dd className="tabular">{c.cin}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('cp33.constitution')}</dt>
            <dd>{c.entityType}</dd>
            <dt className="text-muted-foreground">{t('cp33.kyc')}</dt>
            <dd>
              <Chip tone={kyc === 'verified' ? 'success' : 'warning'}>{t(`cp33.kycState.${kyc}`)}</Chip>
              {c.reKycDue && <span className="ml-2 text-caption text-muted-foreground">{t('cp33.reKyc', { date: formatDate(c.reKycDue) })}</span>}
            </dd>
          </dl>
          {isAdmin && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate('/customer/help?new=account')}>
              {t('cp33.requestChange')}
            </Button>
          )}
        </section>

        <KycDocs c={c} isAdmin={isAdmin} />

        <BillingSettings c={c} isAdmin={isAdmin} />

        <section className={card} aria-label={t('cp33.bank')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <Landmark className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.bank')}
          </h2>
          {c.bank ? (
            <p data-testid="bank">
              {c.bank.name} ••{c.bank.account.slice(-4)} <span className="text-caption text-muted-foreground">· {c.bank.ifsc}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{t('cp33.noBank')}</p>
          )}
          <p className="text-caption text-muted-foreground">{t('cp33.bankUse')}</p>
          {isAdmin && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setBankOpen(true)}>
              {t('cp33.changeBank')}
            </Button>
          )}
        </section>

        <section className={card} aria-label={t('cp33.kam')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <UserRound className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.kam')}
          </h2>
          {kam ? (
            <p>
              <span className="font-medium">{kam.name}</span> · {kam.title}
              <span className="block text-caption text-muted-foreground">{kam.email}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{t('cp33.noKam')}</p>
          )}
        </section>

        <section className={card} aria-label={t('cp33.rateCard')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <FileText className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.rateCard')}
          </h2>
          {rateCard && (
            <p>
              {rateCard.name}
              <span className="block text-caption text-muted-foreground">{t('cp33.valid', { from: formatDate(rateCard.validFrom), to: formatDate(rateCard.validTo) })}</span>
            </p>
          )}
          <p className="text-caption text-muted-foreground">
            {c.billing === 'credit' ? t('cp33.credit', { limit: formatINR(c.creditLimit), days: c.creditTermsDays, deposit: formatINR(c.securityDeposit) }) : t('cp33.prepaid')}
          </p>
          <Button className="mt-3" size="sm" variant="outline" disabled={!rateCard} onClick={() => setRcOpen(true)}>
            {t('cp33.viewRateCard')}
          </Button>
        </section>
      </div>

      {rateCard && (
        <Dialog open={rcOpen} onOpenChange={setRcOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{rateCard.name}</DialogTitle>
              <DialogDescription>{t('cp33.readOnly')}</DialogDescription>
            </DialogHeader>
            {rateCard.ptl.length > 0 && <PtlTable data={data} card={rateCard} />}
            <ParcelTable card={rateCard} />
            <Surcharges data={data} card={rateCard} />
          </DialogContent>
        </Dialog>
      )}
      {bankOpen && <BankDialog c={c} onClose={() => setBankOpen(false)} />}
    </div>
  )
}

function KycDocs({ c, isAdmin }: { c: Customer; isAdmin: boolean }) {
  const { t } = useTranslation()
  const { user } = useCustomerSession()
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<DocKind>()
  return (
    <section className={card} aria-label={t('cp33.docs')}>
      <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
        <FileText className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.docs')}
      </h2>
      {(c.kycDocs ?? []).length === 0 ? (
        <p className="text-muted-foreground">{t('cp33.noDocs')}</p>
      ) : (
        <ul className="flex flex-col divide-y" data-testid="kyc-docs">
          {c.kycDocs!.map((d) => (
            <li key={d.kind} className="flex items-center justify-between gap-2 py-2" aria-label={t(`cp33.doc.${d.kind}`)}>
              <span>
                {t(`cp33.doc.${d.kind}`)}
                <span className="block text-caption text-muted-foreground">
                  {d.file} · {t('cp33.uploaded', { date: formatDate(d.uploadedAt) })}
                  {d.expiresOn && ` · ${t('cp33.expires', { date: formatDate(d.expiresOn) })}`}
                </span>
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setKind(d.kind)
                    input.current?.click()
                  }}
                >
                  {t('cp33.replace')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        aria-label={t('cp33.replace')}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && kind) {
            useDemoStore.getState().replaceKycDoc(c.id, kind, f.name, user.id)
            toast.success(t('cp33.replaced', { doc: t(`cp33.doc.${kind}`) }))
          }
          e.target.value = ''
        }}
      />
    </section>
  )
}

function BillingSettings({ c, isAdmin }: { c: Customer; isAdmin: boolean }) {
  const { t } = useTranslation()
  const { user } = useCustomerSession()
  const [f, setF] = useState<Prefs>(c.billingPrefs ?? { address: '', frequency: 'monthly', emails: '', poMandatory: false })
  const valid = f.address.trim() && f.emails.split(/[,;\s]+/).filter(Boolean).every((e) => /^\S+@\S+\.\S+$/.test(e)) && f.emails.trim()
  return (
    <section className={card} aria-label={t('cp33.billing')}>
      <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
        <Receipt className="size-5 text-muted-foreground" aria-hidden /> {t('cp33.billing')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('cp33.f.address')} htmlFor="b-address" required className="sm:col-span-2">
          <Input id="b-address" disabled={!isAdmin} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label={t('cp33.f.frequency')} htmlFor="b-freq">
          <NativeSelect id="b-freq" disabled={!isAdmin} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as Prefs['frequency'] })}>
            <option value="monthly">{t('cp33.freq.monthly')}</option>
            <option value="perShipment">{t('cp33.freq.perShipment')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('cp33.f.emails')} htmlFor="b-emails" required hint={t('cp33.emailsHint')}>
          <Input id="b-emails" disabled={!isAdmin} value={f.emails} onChange={(e) => setF({ ...f, emails: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 sm:col-span-2">
          <Checkbox disabled={!isAdmin} checked={f.poMandatory} onCheckedChange={(v) => setF({ ...f, poMandatory: !!v })} /> {t('cp33.f.po')}
        </label>
      </div>
      {isAdmin && (
        <Button className="mt-3" size="sm" disabled={!valid} onClick={() => (useDemoStore.getState().saveBillingPrefs(c.id, f, user.id), toast.success(t('cp33.billingSaved')))}>
          {t('common.save')}
        </Button>
      )}
    </section>
  )
}

function BankDialog({ c, onClose }: { c: Customer; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useCustomerSession()
  const [b, setB] = useState({ holder: c.legalName, account: '', ifsc: '' })
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const formOk = b.holder.trim() && b.account.replace(/\D/g, '').length >= 9 && /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(b.ifsc.trim())

  const send = async () => {
    setBusy(true)
    await sendOtp(user.mobile)
    setBusy(false)
    setStep('otp')
  }
  const verify = () => {
    if (!verifyLoginOtp(otp)) return setErr(t('cp33.otpWrong'))
    const r = useDemoStore.getState().changeBank(c.id, b, user.id)
    if (!r.ok) return setErr(r.nameReturned ? t('cp33.pennyFail', { name: r.nameReturned, pct: r.matchPct }) : t('cp33.bankInvalid'))
    toast.success(t('cp33.bankChanged', { name: r.nameReturned, pct: r.matchPct }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('cp33.changeBank')} <SimulatedTag />
          </DialogTitle>
          <DialogDescription>{step === 'form' ? t('cp33.bankNote') : t('cp33.otpSent', { mobile: user.mobile, otp: DEMO_LOGIN_OTP })}</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <div className="grid gap-3">
            <Field label={t('cp33.f.holder')} htmlFor="bk-holder" required>
              <Input id="bk-holder" value={b.holder} onChange={(e) => setB({ ...b, holder: e.target.value })} />
            </Field>
            <Field label={t('cp33.f.account')} htmlFor="bk-acc" required>
              <Input id="bk-acc" inputMode="numeric" value={b.account} onChange={(e) => setB({ ...b, account: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="IFSC" htmlFor="bk-ifsc" required>
              <Input id="bk-ifsc" value={b.ifsc} onChange={(e) => setB({ ...b, ifsc: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        ) : (
          <Field label={t('cp33.f.otp')} htmlFor="bk-otp" required>
            <Input id="bk-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        {err && (
          <p role="alert" className="text-caption text-status-danger">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {step === 'form' ? (
            <Button disabled={!formOk || busy} onClick={() => void send()}>
              {busy && <Loader2 className="animate-spin" />} {t('cp33.sendOtp')}
            </Button>
          ) : (
            <Button disabled={otp.length !== 6} onClick={verify}>
              {t('cp33.verifyChange')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
