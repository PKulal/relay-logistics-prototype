/**
 * PP-26 Invoices and 3-way match — docs/02-partner-portal.md. Source §9:
 * self-billing option (Logisco generates the invoice from completed legs);
 * otherwise the partner uploads it. Each line is matched against rate card ×
 * verified weight × e-POD; mismatches go to the dispute desk (48-hour SLA).
 * SIMULATED: the PDF and the line file (the legs come from completed work).
 */
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { cn } from '@/shared/lib/utils'
import { invoicePayable, isSelfBilling, matchedAmount, matchStatus, unbilledLegs, verifiedKg } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import { istDate, minutesBetween } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { PartnerInvoice, PartnerInvoiceLine } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { MATCH_TONE, PARTNER_INVOICE_TONE } from '@shared/ui/moneyTones'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { lineResult } from './financeText'
import { usePartnerSession } from './usePartnerSession'

const cycleLabel = (c: string) => {
  const [a, b] = c.split('/')
  return a === b ? formatDate(a) : `${formatDate(a).slice(0, 6)} – ${formatDate(b)}`
}

export default function PP26Invoices() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  const selfBilling = isSelfBilling(data, partner.id)
  const invoices = Object.values(data.partnerInvoices)
    .filter((i) => i.partnerId === partner.id)
    .sort((a, b) => (b.date ?? b.cycle).localeCompare(a.date ?? a.cycle))
  const open = data.partnerInvoices[params.get('invoice') ?? '']
  if (open?.partnerId === partner.id) return <InvoiceMatch inv={open} onBack={() => setParams({})} />
  if (params.get('upload') && !selfBilling) return <UploadInvoice onDone={(id) => setParams(id ? { invoice: id } : {})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp26.title')}
        subtitle={selfBilling ? t('pp26.subSelf') : t('pp26.subUpload')}
        actions={
          !selfBilling && (
            <Button onClick={() => setParams({ upload: '1' })}>
              <Upload /> {t('pp26.upload')}
            </Button>
          )
        }
        className="mb-0"
      />
      {invoices.length === 0 ? (
        <EmptyState title={t('pp26.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-invoices">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp26.col.no')}</th>
                <th>{t('pp26.col.cycle')}</th>
                <th className="text-right">{t('pp26.col.legs')}</th>
                <th className="text-right">{t('pp26.col.amounts')}</th>
                <th>{t('pp26.col.match')}</th>
                <th>{t('pp26.col.mode')}</th>
                <th>{t('pp26.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b last:border-0" aria-label={i.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ invoice: i.id })}>
                      {i.id}
                    </button>
                  </td>
                  <td className="tabular">{cycleLabel(i.cycle)}</td>
                  <td className="tabular text-right">{i.lines.length || '—'}</td>
                  <td className="tabular text-right">
                    {formatINR(i.taxable)} / {formatINR(i.gst)} / <span className="font-semibold">{formatINR(i.total)}</span>
                  </td>
                  <td>
                    <Chip tone={MATCH_TONE[matchStatus(i)]}>{t(`pp26.match.${matchStatus(i)}`)}</Chip>
                  </td>
                  <td>
                    <Chip tone="neutral">{t(`pp26.mode.${i.mode}`)}</Chip>
                  </td>
                  <td>
                    <Chip tone={PARTNER_INVOICE_TONE[i.status]}>{t(`pp26.status.${i.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function InvoiceMatch({ inv, onBack }: { inv: PartnerInvoice; onBack: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const { user } = usePartnerSession()
  const result = (l: PartnerInvoiceLine) => lineResult(t, l)
  const [disputing, setDisputing] = useState<string>()
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const exportLines = () => {
    const book = XLSX.utils.book_new()
    const rows = inv.lines.map((l) => ({ [t('pp26.line.job')]: l.legId, [t('pp26.line.rate')]: l.rate, [t('pp26.line.weight')]: l.verifiedWeight, [t('pp26.line.billed')]: l.billed, [t('pp26.line.matched')]: l.matched, [t('pp26.line.result')]: result(l), [t('pp26.line.final')]: l.final ?? '' }))
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Lines')
    XLSX.writeFile(book, `${inv.id.replaceAll('/', '-')}.xlsx`)
  }
  const send = (legId: string) => {
    useDemoStore.getState().disputeLine(inv.id, legId, reason, files, user.id)
    toast.success(t('pp26.disputed'))
    setDisputing(undefined)
    setReason('')
    setFiles([])
  }
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('pp26.back')}
      </button>
      <PageHeader
        title={inv.id}
        subtitle={t('pp26.detailSub', { cycle: cycleLabel(inv.cycle), mode: t(`pp26.mode.${inv.mode}`), payable: formatINR(invoicePayable(data, inv)) })}
        actions={
          inv.lines.length > 0 && (
            <Button variant="outline" onClick={exportLines}>
              <FileSpreadsheet /> {t('pp26.linesExcel')}
            </Button>
          )
        }
        className="mb-0"
      />
      <div className="flex flex-wrap gap-2">
        <Chip tone={MATCH_TONE[matchStatus(inv)]}>{t(`pp26.match.${matchStatus(inv)}`)}</Chip>
        <Chip tone={PARTNER_INVOICE_TONE[inv.status]}>{t(`pp26.status.${inv.status}`)}</Chip>
      </div>
      {!inv.lines.length ? (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">{t('pp26.noLines')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="match-lines">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp26.line.job')}</th>
                <th>{t('pp26.line.rate')}</th>
                <th className="text-right">{t('pp26.line.weight')}</th>
                <th>{t('pp26.line.pod')}</th>
                <th className="text-right">{t('pp26.line.billedMatched')}</th>
                <th>{t('pp26.line.result')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => {
                const openLine = l.result === 'mismatch' && l.final === undefined && !l.dispute
                return (
                  <tr key={l.legId} className="border-b align-top last:border-0" aria-label={l.legId}>
                    <td className="tabular px-4 py-2">{l.legId}</td>
                    <td className="tabular">{t(`ponb.unit.${l.unit}`, { rate: formatINR(l.rate) })}</td>
                    <td className="tabular text-right">{formatKg(l.verifiedWeight)}</td>
                    <td>{l.pod ? <CheckCircle2 className="size-4 text-status-success" aria-label={t('pp26.podYes')} /> : <XCircle className="size-4 text-status-danger" aria-label={t('pp26.podNo')} />}</td>
                    <td className="tabular text-right">
                      {formatINR(l.billed)} / {formatINR(l.matched)}
                    </td>
                    <td>
                      <Chip tone={l.result === 'match' ? 'success' : 'warning'}>{result(l)}</Chip>
                      {l.dispute && (
                        <p className="mt-1 text-caption text-muted-foreground">
                          {l.dispute.decision
                            ? t('pp26.decided', { decision: t(`erp32.decision.${l.dispute.decision}`), amount: formatINR(l.final!), note: l.dispute.note ?? '' })
                            : t('pp26.underDispute', { hours: Math.max(0, Math.floor(minutesBetween(now, l.dispute.dueAt) / 60)) })}
                        </p>
                      )}
                      {l.partner === 'accepted' && <p className="mt-1 text-caption text-muted-foreground">{t('pp26.acceptedAt', { amount: formatINR(l.final!) })}</p>}
                    </td>
                    <td className="py-2">
                      {openLine &&
                        (disputing === l.legId ? (
                          <div className="flex w-72 flex-col gap-2">
                            <Field label={t('pp26.reason')} htmlFor={`dr-${l.legId}`} required small>
                              <Input id={`dr-${l.legId}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                            </Field>
                            <Field label={t('pp26.evidence')} htmlFor={`df-${l.legId}`} small>
                              <Input id={`df-${l.legId}`} type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
                            </Field>
                            <div className="flex gap-2">
                              <Button size="sm" disabled={!reason.trim()} onClick={() => send(l.legId)}>
                                {t('pp26.sendDispute')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDisputing(undefined)}>
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                useDemoStore.getState().acceptMatchedLine(inv.id, l.legId, user.id)
                                toast.success(t('pp26.accepted'))
                              }}
                            >
                              {t('pp26.accept')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDisputing(l.legId)}>
                              {t('pp26.dispute')}
                            </Button>
                          </div>
                        ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function UploadInvoice({ onDone }: { onDone: (id?: string) => void }) {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const legs = unbilledLegs(data, partner.id)
  const [no, setNo] = useState('')
  const [date, setDate] = useState(istDate(now))
  const [amount, setAmount] = useState('')
  const [pdf, setPdf] = useState('')
  const [lineFile, setLineFile] = useState('')
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [include, setInclude] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const kg = (id: string) => Number(weights[id] ?? verifiedKg(data, data.legs[id]))
  const billedOf = (id: string) => matchedAmount(data, data.legs[id], kg(id))
  const sum = Math.round(include.reduce((s, id) => s + billedOf(id), 0) * 100) / 100
  const req = t('cp04.err.required')
  const errors = {
    no: !no.trim() ? req : data.partnerInvoices[no.trim()] ? t('pp26.err.dup') : undefined,
    amount: !(Number(amount) > 0) ? req : Number(amount) !== sum ? t('pp26.err.sum', { sum: formatINR(sum) }) : undefined,
    pdf: !pdf ? req : undefined,
    lineFile: !lineFile ? req : !include.length ? t('pp26.err.lines') : undefined,
  }
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined)
  // Line file read: SIMULATED — the rows are the partner's completed, unbilled legs
  const readLines = (name: string) => {
    setLineFile(name)
    setInclude(legs.map((l) => l.id))
  }
  // Sample: DR/0099 billing the hero line-haul at 170 kg (seed-data.md §3), else the latest leg 8 kg over
  const sample = () => {
    const hero = legs.find((l) => l.id === 'JOB-000781-L3') ?? legs.at(-1)
    if (!hero) return
    const rate = hero.rateLineId ? data.partnerRates[hero.rateLineId] : undefined
    const w = hero.id === 'JOB-000781-L3' ? 170 : Math.max(verifiedKg(data, data.legs[hero.id]), rate?.minKg ?? 0) + 8
    setNo('DR/0099')
    setPdf('INV-DR-0099.pdf')
    setLineFile('lines.xlsx')
    setInclude([hero.id])
    setWeights({ [hero.id]: String(w) })
    setAmount(String(matchedAmount(data, data.legs[hero.id], w)))
  }
  const submit = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return toast.error(t('cp04.fix'))
    const id = useDemoStore.getState().uploadPartnerInvoice(partner.id, { no, date, amount: Number(amount), pdf, lineFile, lines: include.map((legId) => ({ legId, billedWeight: kg(legId) })) }, user.id)
    if (!id) return toast.error(t('pp26.failed'))
    toast.success(t('pp26.uploaded', { id }))
    onDone(id)
  }
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => onDone()} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('pp26.back')}
      </button>
      <PageHeader
        title={t('pp26.uploadTitle')}
        subtitle={t('pp26.uploadSub')}
        actions={
          <Button variant="outline" onClick={sample} disabled={!legs.length}>
            {t('pp26.sample')}
          </Button>
        }
        className="mb-0"
      />
      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <Field label={t('pp26.f.no')} htmlFor="up-no" required error={err('no')}>
          <Input id="up-no" className="tabular" value={no} onChange={(e) => setNo(e.target.value.toUpperCase())} />
        </Field>
        <Field label={t('pp26.f.date')} htmlFor="up-date" required>
          <Input id="up-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('pp26.f.amount')} htmlFor="up-amt" required error={err('amount')} hint={t('pp26.f.amountHint')}>
          <Input id="up-amt" type="number" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('pp26.f.pdf')} htmlFor="up-pdf" required error={err('pdf')} hint={pdf || undefined}>
          <Input id="up-pdf" type="file" accept=".pdf" onChange={(e) => setPdf(e.target.files?.[0]?.name ?? '')} />
        </Field>
        <Field label={t('pp26.f.lines')} htmlFor="up-lines" required error={err('lineFile')} hint={lineFile || t('pp26.f.linesHint')}>
          <Input id="up-lines" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => readLines(e.target.files?.[0]?.name ?? '')} />
        </Field>
      </section>
      {lineFile && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
            {t('pp26.fromFile', { count: include.length })} <SimulatedTag />
          </h2>
          {legs.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t('pp26.noLegs')}</p>
          ) : (
            <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="upload-lines">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="w-10 px-4 py-2" />
                  <th>{t('pp26.line.job')}</th>
                  <th>{t('pp26.line.done')}</th>
                  <th className="text-right">{t('pp26.line.weight')}</th>
                  <th>{t('pp26.line.billedWeight')}</th>
                  <th className="text-right">{t('pp26.line.billed')}</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l) => {
                  const over = kg(l.id) !== verifiedKg(data, data.legs[l.id])
                  return (
                    <tr key={l.id} className="border-b last:border-0" aria-label={l.id}>
                      <td className="px-4 py-2">
                        <Checkbox aria-label={t('pp26.includeX', { id: l.id })} checked={include.includes(l.id)} onCheckedChange={(v) => setInclude(v === true ? [...include, l.id] : include.filter((x) => x !== l.id))} />
                      </td>
                      <td className="tabular">{l.id}</td>
                      <td className="tabular">{formatDateTime(l.doneAt)}</td>
                      <td className="tabular text-right">{formatKg(verifiedKg(data, data.legs[l.id]))}</td>
                      <td>
                        <Input aria-label={t('pp26.billedWeightX', { id: l.id })} type="number" className={cn('tabular h-8 w-24', over && 'border-status-warning')} value={weights[l.id] ?? String(verifiedKg(data, data.legs[l.id]))} onChange={(e) => setWeights({ ...weights, [l.id]: e.target.value })} />
                      </td>
                      <td className="tabular text-right">{formatINR(billedOf(l.id))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <p className="tabular flex items-center justify-end gap-2 p-4 font-semibold">
            {include.some((id) => kg(id) !== verifiedKg(data, data.legs[id])) && (
              <span className="flex items-center gap-1 text-caption font-medium text-status-warning">
                <AlertTriangle className="size-4" aria-hidden /> {t('pp26.willMismatch')}
              </span>
            )}
            {t('pp26.lineTotal', { amount: formatINR(sum) })}
          </p>
        </section>
      )}
      <Button className="self-start" onClick={submit}>
        {t('pp26.submit')}
      </Button>
    </div>
  )
}
