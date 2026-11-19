/**
 * ERP-12 KYC verification desk and hub audit — docs/04-erp-control-tower.md.
 * Source §4 Phase 2 Steps 3–4 and §12 (Document OCR & KYC Fraud): automatic
 * check results, documents with what the OCR read and its flags, the §4.1
 * checklist for the type, the outcome (Approved / Conditionally approved /
 * Rejected) and the hub audit with geo-tagged photos.
 * Targets: KYC within 48 hours, audit within 5 days.
 */
import { Camera, CheckCircle2, CircleAlert, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { AUDIT_ITEMS, kycChecklist, needsHubAudit } from '@shared/engines/partnerOnboarding'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { addDaysToDate, istDate, minutesBetween } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import { auditPhoto, type AuditItems } from '@shared/store/partnerOnboardingActions'
import type { AuditItem, PartnerApplication, PartnerCheckKey, PartnerDocKey, VerificationResult } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { AppStatusChip, DocStatusChip, ResultChip, useConditionText, useFlagText } from '@shared/ui/PartnerOnboardingBits'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useErpSession } from './useErpSession'

const CHECKS: PartnerCheckKey[] = ['gstin', 'pan', 'pennyDrop', 'vahan', 'sarathi', 'digilocker']

export default function ERP12KycDesk() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  // Queue: submitted KYC and booked audits; open cases first
  const queue = Object.values(data.applications)
    .filter((a) => a.kycSubmittedAt || a.hubAudit)
    .sort((a, b) => Number(b.status === 'kyc') - Number(a.status === 'kyc') || (b.kycSubmittedAt ?? '').localeCompare(a.kycSubmittedAt ?? ''))
  const selected = data.applications[params.get('app') ?? ''] ?? queue[0]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp12.title')} subtitle={t('erp12.subtitle', { count: queue.filter((a) => a.status === 'kyc').length })} className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <ul className="flex flex-col gap-2" aria-label={t('erp12.queue')}>
          {queue.map((a) => {
            const p = data.partners[a.partnerId]
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
                    {a.ref} · {t('partner.typeShort', { type: p.type })}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <AppStatusChip status={a.status} />
                    {a.hubAudit && !a.hubAudit.result && <span className="text-caption text-status-warning">{t('erp12.auditDue', { date: formatDate(a.hubAudit.date) })}</span>}
                  </span>
                </button>
              </li>
            )
          })}
          {queue.length === 0 && <li className="text-muted-foreground">{t('erp12.empty')}</li>}
        </ul>
        {selected && <Case key={selected.id} app={selected} />}
      </div>
    </div>
  )
}

function Case({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const p = data.partners[app.partnerId]
  const rows = kycChecklist(app, p.type)
  const required = rows.filter((r) => r.required)
  const verified = required.filter((r) => app.documents.find((d) => d.key === r.key)?.status === 'verified').length
  const hoursIn = app.kycSubmittedAt ? Math.round(minutesBetween(app.kycSubmittedAt, app.outcome?.at ?? now) / 60) : 0

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-label={p.name}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-card-title">
            {p.name} · {app.ref}
          </h2>
          {app.outcome ? <ResultChip result={app.outcome.result} /> : <AppStatusChip status={app.status} />}
        </div>
        <p className="text-caption text-muted-foreground">
          {t('partner.typeShort', { type: p.type })} · {p.gstin || t('erp11.d.noGst')} · {p.pan}
          {app.kycSubmittedAt && ` · ${t('erp12.submitted', { at: formatDateTime(app.kycSubmittedAt) })}`}
        </p>
        {app.kycSubmittedAt && (
          <p className={cn('text-caption font-medium', hoursIn > 48 ? 'text-status-danger' : 'text-status-success')}>
            {app.outcome ? t('erp12.decidedIn', { hours: hoursIn }) : t('erp12.openFor', { hours: hoursIn })} · {t('erp12.target48')}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="chk-h">
        <h3 id="chk-h" className="mb-2 font-semibold">
          {t('erp12.apiChecks', { ok: CHECKS.filter((k) => app.checks[k]?.ok).length, fail: CHECKS.filter((k) => app.checks[k] && !app.checks[k]!.ok).length })} <SimulatedTag />
        </h3>
        <ul className="grid gap-1 sm:grid-cols-2" data-testid="api-checks">
          {CHECKS.map((k) => {
            const c = app.checks[k]
            return (
              <li key={k} className="flex items-center gap-2 text-table">
                {!c ? <span className="size-4 rounded-full border" aria-hidden /> : c.ok ? <CheckCircle2 className="size-4 text-status-success" aria-hidden /> : <CircleAlert className="size-4 text-status-danger" aria-hidden />}
                <span className="font-medium">{t(`ponb.check.${k}`)}</span>
                <span className="truncate text-caption text-muted-foreground">{c ? Object.values(c.detail).filter((v) => typeof v === 'string' && v).slice(0, 2).join(' · ') : t('erp12.notRun')}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <Documents app={app} verified={verified} total={required.length} />
      {app.status === 'kyc' && !app.outcome && <Decision app={app} />}
      {needsHubAudit(p.type, app.hubs.length) && <AuditPanel app={app} />}
    </div>
  )
}

function Documents({ app, verified, total }: { app: PartnerApplication; verified: number; total: number }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const flagText = useFlagText()
  const [asking, setAsking] = useState<PartnerDocKey>()
  const [reason, setReason] = useState('')
  const rows = kycChecklist(app, data.partners[app.partnerId].type)
  const canAsk = user.role === 'partnerManagement' && !['rejected', 'live'].includes(app.status)

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="doc-h">
      <h3 id="doc-h" className="mb-2 font-semibold">
        {t('erp12.documents')} · <span data-testid="checklist-count">{t('erp12.checklist', { n: verified, total })}</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-table" data-testid="documents">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('erp12.col.doc')}</th>
              <th>{t('erp12.col.file')}</th>
              <th>{t('erp12.col.ocr')}</th>
              <th>{t('erp12.col.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = app.documents.find((x) => x.key === r.key)
              return (
                <tr key={r.key} className="border-b align-top last:border-0">
                  <td className="py-2">
                    {t(`ponb.doc.${r.key}`)}
                    {!r.required && <span className="text-caption text-muted-foreground"> ({t('pp06.optional')})</span>}
                  </td>
                  <td className="py-2">{d?.file ? (d.viaDigilocker ? t('pp06.viaDigilocker') : d.file) : '—'}</td>
                  <td className="py-2 text-caption">
                    {d?.ocr?.map((o) => (
                      <span key={o.label} className="block">
                        {t(`ponb.ocr.${o.label}`)}: {o.label === 'expiry' && o.value ? formatDate(o.value) : o.value}
                      </span>
                    ))}
                    {d?.status === 'flagged' && <span className="block font-medium text-status-danger">{flagText(d)}</span>}
                  </td>
                  <td className="py-2">
                    <DocStatusChip doc={d} now={now} />
                  </td>
                  <td className="py-2 text-right">
                    {canAsk && d?.file && d.status !== 'flagged' && asking !== r.key && (
                      <Button variant="ghost" size="sm" onClick={() => (setAsking(r.key), setReason(''))}>
                        {t('erp12.requestReupload')}
                      </Button>
                    )}
                    {asking === r.key && (
                      <div className="flex min-w-64 gap-2">
                        <Input aria-label={t('erp12.reupReason')} placeholder={t('erp12.reupReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
                        <Button size="sm" disabled={!reason.trim()} onClick={() => (useDemoStore.getState().requestReupload(app.id, r.key, reason, user.id), setAsking(undefined), toast.success(t('erp12.reupSent')))}>
                          {t('erp12.send')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Decision({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const now = useDemoNow()
  const condText = useConditionText()
  const flagged = app.documents.filter((d) => d.status === 'flagged')
  const due = addDaysToDate(istDate(now), 7)
  const [result, setResult] = useState<VerificationResult>(flagged.length ? 'conditional' : 'approved')
  const [conds, setConds] = useState(flagged.map((d) => ({ text: condText({ text: '', due, docKey: d.key }), due, docKey: d.key as PartnerDocKey | undefined })))
  const [reasons, setReasons] = useState('')
  const canDecide = user.role === 'partnerManagement'
  const valid = result === 'approved' || (result === 'conditional' && conds.length > 0 && conds.every((c) => c.text.trim() && c.due)) || (result === 'rejected' && reasons.trim())

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dec-h">
      <h3 id="dec-h" className="font-semibold">
        {t('erp12.decision')}
      </h3>
      <RadioGroup value={result} onValueChange={(v) => setResult(v as VerificationResult)} className="flex flex-wrap gap-4" aria-label={t('erp12.outcome')}>
        {(['approved', 'conditional', 'rejected'] as const).map((r) => (
          <label key={r} className="flex items-center gap-2">
            <RadioGroupItem value={r} /> {t(`ponb.result.${r}`)}
          </label>
        ))}
      </RadioGroup>
      {result === 'conditional' && (
        <div className="flex flex-col gap-2">
          {conds.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <Input aria-label={t('erp12.condition', { n: i + 1 })} value={c.text} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <Input aria-label={t('erp12.conditionDue', { n: i + 1 })} type="date" value={c.due} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setConds(conds.filter((_, j) => j !== i))}>
                {t('pp04.remove')}
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setConds([...conds, { text: '', due, docKey: undefined }])}>
            {t('erp12.addCondition')}
          </Button>
        </div>
      )}
      {result === 'rejected' && (
        <Field label={t('erp12.reasons')} htmlFor="e12-reasons" required>
          <Input id="e12-reasons" value={reasons} onChange={(e) => setReasons(e.target.value)} />
        </Field>
      )}
      <Button className="self-start" disabled={!canDecide || !valid} onClick={() => (useDemoStore.getState().decideVerification(app.id, { result, conditions: conds, reasons }, user.id), toast.success(t('erp12.saved')))}>
        {t('erp12.save')}
      </Button>
      {!canDecide && <p className="text-caption text-muted-foreground">{t('erp12.pmOnly')}</p>}
    </section>
  )
}

type Draft = Partial<Record<AuditItem, { result?: 'pass' | 'fail' | 'observation'; note: string; photo?: AuditItems[AuditItem]['photo'] }>>

function AuditPanel({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const h = app.hubAudit
  const [draft, setDraft] = useState<Draft>({})
  const [result, setResult] = useState<VerificationResult>('approved')
  const canRecord = user.role === 'hubAuditor' && !!h && !h.result
  const complete = AUDIT_ITEMS.every((k) => draft[k]?.result && draft[k]?.photo)
  const set = (k: AuditItem, p: Partial<NonNullable<Draft[AuditItem]>>) => setDraft({ ...draft, [k]: { note: '', ...draft[k], ...p } })

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="aud-h" data-testid="audit-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="aud-h" className="font-semibold">
          {t('erp12.hubAudit')}
        </h3>
        {h?.result && <ResultChip result={h.result} />}
      </div>
      {!h && <p className="text-muted-foreground">{t('erp12.notBooked')}</p>}
      {h && (
        <p className="text-table">
          {t('erp12.slot', { auditor: data.staff[h.auditorId]?.name ?? '', date: formatDate(h.date), window: t(`ponb.window.${h.window}`), contact: h.contact, phone: h.phone, hub: app.hubs[0]?.name ?? '' })}
        </p>
      )}
      {h?.items && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {AUDIT_ITEMS.map((k) => (
            <li key={k} className="flex items-center gap-2 text-table">
              <span className="font-medium">{t(`ponb.audit.${k}`)}</span> {t(`ponb.auditResult.${h.items![k].result}`)}
              <span className="flex items-center gap-1 text-caption text-muted-foreground">
                <MapPin className="size-3" aria-hidden /> {h.items![k].photo.lat.toFixed(4)}, {h.items![k].photo.lng.toFixed(4)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRecord && (
        <>
          <ul className="flex flex-col divide-y">
            {AUDIT_ITEMS.map((k) => (
              <li key={k} className="grid items-center gap-2 py-2 sm:grid-cols-[9rem_1fr_1fr_auto]" aria-label={t(`ponb.audit.${k}`)}>
                <span className="font-medium">{t(`ponb.audit.${k}`)}</span>
                <RadioGroup value={draft[k]?.result ?? ''} onValueChange={(v) => set(k, { result: v as 'pass' })} className="flex gap-3" aria-label={t(`ponb.audit.${k}`)}>
                  {(['pass', 'fail', 'observation'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-1 text-caption">
                      <RadioGroupItem value={r} /> {t(`ponb.auditResult.${r}`)}
                    </label>
                  ))}
                </RadioGroup>
                <Input aria-label={t('erp12.note', { item: t(`ponb.audit.${k}`) })} placeholder={t('erp12.notePh')} value={draft[k]?.note ?? ''} onChange={(e) => set(k, { note: e.target.value })} />
                <Button variant={draft[k]?.photo ? 'ghost' : 'outline'} size="sm" onClick={() => set(k, { photo: auditPhoto(data, app, now) })}>
                  <Camera /> {draft[k]?.photo ? t('erp12.photoTaken') : t('erp12.takePhoto')}
                </Button>
              </li>
            ))}
          </ul>
          <RadioGroup value={result} onValueChange={(v) => setResult(v as VerificationResult)} className="flex flex-wrap gap-4" aria-label={t('erp12.auditResult')}>
            {(['approved', 'conditional', 'rejected'] as const).map((r) => (
              <label key={r} className="flex items-center gap-2">
                <RadioGroupItem value={r} /> {t(`ponb.result.${r}`)}
              </label>
            ))}
          </RadioGroup>
          <Button
            className="self-start"
            disabled={!complete}
            onClick={() => {
              const items = Object.fromEntries(AUDIT_ITEMS.map((k) => [k, { result: draft[k]!.result!, note: draft[k]!.note.trim() || undefined, photo: draft[k]!.photo! }])) as AuditItems
              useDemoStore.getState().recordHubAudit(app.id, items, result, user.id)
              toast.success(t('erp12.auditSaved'))
            }}
          >
            {t('erp12.saveAudit')}
          </Button>
        </>
      )}
      {h && !h.result && user.role !== 'hubAuditor' && <p className="text-caption text-muted-foreground">{t('erp12.auditorOnly')}</p>}
    </section>
  )
}
