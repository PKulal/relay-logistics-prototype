/**
 * PP-06 Documents and KYC — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 2 Step 3 and the §4.1 checklist: only the documents ticked
 * for the partner's type are shown. GSTIN / PAN by API, bank penny-drop,
 * Vahan and Sarathi via ULIP (Types C / D / E; B with own fleet), DigiLocker
 * fetch, and AI OCR flags on submit. Target: within 48 hours.
 * SIMULATED: every API, the OCR and DigiLocker.
 */
import { CheckCircle2, CircleAlert, Loader2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { kycChecklist, kycReadyToSubmit, type ChecklistRow } from '@shared/engines/partnerOnboarding'
import { useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { simulateLatency } from '@shared/sim/latency'
import { useDemoStore } from '@shared/store'
import type { PartnerApplication, PartnerCheckKey, PartnerDocKey } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { DocStatusChip, useFlagText } from '@shared/ui/PartnerOnboardingBits'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { usePartnerSession } from '../usePartnerSession'
import { PartnerOnboardingSteps, usePartnerApplication } from './steps'

const SECTIONS: { key: string; docs: PartnerDocKey[] }[] = [
  { key: 'company', docs: ['gstin', 'pan', 'incorporation', 'udyam', 'transportLicence'] },
  { key: 'bank', docs: ['bank'] },
  { key: 'insurance', docs: ['insurance', 'premisesInsurance'] },
  { key: 'vehicles', docs: ['vehicles'] },
  { key: 'staff', docs: ['driverLicence', 'policeVerification'] },
  { key: 'hub', docs: ['hubDocs'] },
]

export default function PP06Documents() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const app = usePartnerApplication()
  const [busy, setBusy] = useState(false)
  if (!app) return null
  const invited = !['new', 'waitlisted', 'rejected'].includes(app.status)
  if (!invited)
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <PageHeader title={t('pp06.title')} className="mb-0" />
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('pp06.notYet')}</p>
      </div>
    )

  const rows = kycChecklist(app, partner.type)
  const submitted = !!app.kycSubmittedAt
  const { ready, missing } = kycReadyToSubmit(app, partner.type)
  const flagged = app.documents.filter((d) => d.status === 'flagged').length
  const submit = async () => {
    setBusy(true)
    await simulateLatency(600, 900)
    useDemoStore.getState().submitPartnerKyc(app.id, user.id)
    setBusy(false)
    toast.success(t('pp06.submittedToast'))
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('pp06.title')} subtitle={t('pp06.subtitle', { type: partner.type })} className="mb-0" />
      <PartnerOnboardingSteps app={app} current="documents" />

      {submitted && (
        <p className="rounded-xl border bg-card p-4" data-testid="kyc-summary">
          {t('pp06.submittedOn', { at: formatDateTime(app.kycSubmittedAt!) })}{' '}
          {flagged ? (
            <span className="font-semibold text-status-danger">{t('pp06.flaggedCount', { count: flagged })}</span>
          ) : (
            <span className="font-semibold text-status-success">{t('pp06.allClear')}</span>
          )}{' '}
          <Link to="/partner/onboarding/verification" className="text-primary hover:underline">
            {t('pp06.seeOutcome')}
          </Link>
        </p>
      )}

      {SECTIONS.map((s) => {
        const list = rows.filter((r) => s.docs.includes(r.key))
        if (!list.length) return null
        return (
          <section key={s.key} className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby={`sec-${s.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`sec-${s.key}`} className="text-card-title">
                {t(`pp06.section.${s.key}`)}
              </h2>
              {s.key === 'company' && !submitted && <DigiLockerButton app={app} />}
            </div>
            <ul className="flex flex-col divide-y">
              {list.map((r) => (
                <DocRow key={r.key} app={app} row={r} />
              ))}
            </ul>
          </section>
        )
      })}

      {!submitted && (
        <div className="flex flex-col gap-2">
          {!ready && (
            <p className="text-caption text-muted-foreground" data-testid="missing">
              {t('pp06.missing', { list: missing.map((k) => t(`ponb.doc.${k}`)).join(', ') })}
            </p>
          )}
          <Button size="lg" className="self-start" disabled={!ready || busy} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />} {t('pp06.submit')}
          </Button>
          <p className="text-caption text-muted-foreground">{t('pp06.target')}</p>
        </div>
      )}
    </div>
  )
}

function DigiLockerButton({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const done = !!app.checks.digilocker
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || done}
      onClick={async () => {
        setBusy(true)
        await simulateLatency(700, 1000)
        useDemoStore.getState().runPartnerCheck(app.id, { kind: 'digilocker' })
        setBusy(false)
        toast.success(t('pp06.digilockerDone'))
      }}
    >
      {busy && <Loader2 className="animate-spin" />} {done ? t('pp06.digilockerFetched') : t('pp06.digilocker')} <SimulatedTag />
    </Button>
  )
}

const CHECK_OF: Partial<Record<PartnerDocKey, PartnerCheckKey>> = { gstin: 'gstin', pan: 'pan', bank: 'pennyDrop', vehicles: 'vahan', driverLicence: 'sarathi' }

function CheckLine({ app, k }: { app: PartnerApplication; k: PartnerCheckKey }) {
  const { t } = useTranslation()
  const c = app.checks[k]
  if (!c) return null
  const d = c.detail
  const text = c.ok
    ? t(`ponb.checkOk.${k}`, { ...d, date: d.validTill ? formatDate(String(d.validTill)) : d.fitnessTill ? formatDate(String(d.fitnessTill)) : '' })
    : t(`ponb.checkFail.${d.reason === 'duplicate' ? 'duplicate' : d.reason === 'format' ? 'format' : k}`, { ...d })
  return (
    <p className={c.ok ? 'flex items-center gap-1 text-caption text-status-success' : 'flex items-center gap-1 text-caption text-status-danger'} data-testid={`check-${k}`}>
      {c.ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />} {text}
    </p>
  )
}

function DocRow({ app, row }: { app: PartnerApplication; row: ChecklistRow }) {
  const { t } = useTranslation()
  const now = useDemoNow()
  const { partner } = usePartnerSession()
  const flagText = useFlagText()
  const doc = app.documents.find((d) => d.key === row.key)
  const check = CHECK_OF[row.key]
  const editable = !app.kycSubmittedAt || doc?.status === 'flagged'
  const [verifying, setVerifying] = useState(false)
  const [number, setNumber] = useState(doc?.number ?? '')
  const [expiry, setExpiry] = useState(doc?.status === 'flagged' ? '' : (doc?.expiry ?? ''))
  const [bank, setBank] = useState({ holder: partner.name, account: '', confirm: '', ifsc: '' })
  const needsExpiry = row.key === 'insurance' || row.key === 'premisesInsurance'
  const name = t(`ponb.doc.${row.key}`)

  const verify = async (input: Parameters<ReturnType<typeof useDemoStore.getState>['runPartnerCheck']>[1]) => {
    setVerifying(true)
    await simulateLatency(600, 900)
    useDemoStore.getState().runPartnerCheck(app.id, input)
    setVerifying(false)
  }
  const upload = (file?: File) => {
    if (!file) return
    useDemoStore.getState().uploadPartnerDoc(app.id, row.key, { file: file.name, number: needsExpiry ? number.trim() : undefined, expiry: needsExpiry ? expiry : undefined })
    toast.success(t('pp06.uploaded', { doc: name }))
  }
  const bankOk = /^\d{9,18}$/.test(bank.account) && bank.account === bank.confirm && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc) && bank.holder.trim()
  const uploadBlocked = needsExpiry && (!number.trim() || !expiry)

  return (
    <li className="flex flex-col gap-2 py-3" aria-label={name} id={`doc-${row.key}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{name}</span>{' '}
          <span className="text-caption text-muted-foreground">{row.required ? '' : `(${t('pp06.optional')})`}</span>
          {doc?.file && (
            <span className="block text-caption text-muted-foreground">
              {doc.viaDigilocker ? t('pp06.viaDigilocker') : doc.file}
              {doc.number && ` · ${doc.number}`}
              {doc.expiry && ` · ${t('pp06.expires', { date: formatDate(doc.expiry) })}`}
            </span>
          )}
        </div>
        <DocStatusChip doc={doc} now={now} />
      </div>
      {doc?.status === 'flagged' && (
        <p className="rounded-md bg-status-danger-bg px-3 py-2 text-caption font-medium text-status-danger" data-testid={`flag-${row.key}`}>
          {flagText(doc)}
        </p>
      )}
      {check && <CheckLine app={app} k={check} />}

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          {(row.key === 'gstin' || row.key === 'pan') && !app.checks[row.key]?.ok && (
            <Button type="button" variant="outline" size="sm" disabled={verifying} onClick={() => verify({ kind: row.key as 'gstin' | 'pan' })}>
              {verifying && <Loader2 className="animate-spin" />} {t('pp06.verify', { what: row.key === 'gstin' ? partner.gstin : partner.pan })}
            </Button>
          )}
          {row.key === 'bank' && !app.checks.pennyDrop?.ok && (
            <div className="grid w-full gap-2 sm:grid-cols-4">
              <Field label={t('pp06.holder')} htmlFor="bk-h" small>
                <Input id="bk-h" value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} />
              </Field>
              <Field label={t('pp06.account')} htmlFor="bk-a" small>
                <Input id="bk-a" inputMode="numeric" value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label={t('pp06.confirmAccount')} htmlFor="bk-c" small>
                <Input id="bk-c" inputMode="numeric" value={bank.confirm} onChange={(e) => setBank({ ...bank, confirm: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label={t('pp06.ifsc')} htmlFor="bk-i" small>
                <Input id="bk-i" maxLength={11} value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase().trim() })} />
              </Field>
              <Button type="button" variant="outline" size="sm" className="self-start" disabled={!bankOk || verifying} onClick={() => verify({ kind: 'pennyDrop', holder: bank.holder, account: bank.account, ifsc: bank.ifsc })}>
                {verifying && <Loader2 className="animate-spin" />} {t('pp06.pennyDrop')}
              </Button>
            </div>
          )}
          {(row.key === 'vehicles' || row.key === 'driverLicence') && !app.checks[check!]?.ok && (
            <>
              <Field label={row.key === 'vehicles' ? t('pp06.regNo') : t('pp06.dlNo')} htmlFor={`no-${row.key}`} small>
                <Input id={`no-${row.key}`} className="tabular" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} />
              </Field>
              <Button type="button" variant="outline" size="sm" disabled={!number.trim() || verifying} onClick={() => verify(row.key === 'vehicles' ? { kind: 'vahan', regNo: number } : { kind: 'sarathi', dl: number })}>
                {verifying && <Loader2 className="animate-spin" />} {row.key === 'vehicles' ? t('pp06.verifyVahan') : t('pp06.verifySarathi')}
              </Button>
            </>
          )}
          {needsExpiry && (
            <>
              <Field label={t('pp06.policyNo')} htmlFor={`pol-${row.key}`} small>
                <Input id={`pol-${row.key}`} value={number} onChange={(e) => setNumber(e.target.value)} />
              </Field>
              <Field label={t('pp06.expiry')} htmlFor={`exp-${row.key}`} small>
                <Input id={`exp-${row.key}`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </Field>
            </>
          )}
          {!doc?.viaDigilocker && (
            <label className={uploadBlocked ? 'pointer-events-none opacity-50' : 'cursor-pointer'}>
              <input type="file" className="sr-only" aria-label={t('pp06.uploadFor', { doc: name })} disabled={uploadBlocked} onChange={(e) => upload(e.target.files?.[0])} />
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-caption font-medium hover:bg-accent">
                <Upload className="size-4" aria-hidden /> {doc?.file ? t('pp06.reupload') : t('pp06.upload')}
              </span>
            </label>
          )}
        </div>
      )}
    </li>
  )
}
