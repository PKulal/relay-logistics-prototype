/**
 * ERP-32 Partner payables: 3-way match and dispute desk — docs/04-erp-control-tower.md.
 * Source §9: self-billing from completed legs; AI matches rate card ×
 * verified weight × e-POD per leg; mismatches go to the dispute desk with a
 * 48-hour SLA. Approved invoices go into the next payout batch (ERP-33).
 */
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { lineResult } from '@apps/partner-portal/financeText'
import { invoicePayable, matchStatus, openDisputes, selfBillingPreview } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR, formatKg } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { PartnerInvoice, PartnerInvoiceLine } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { MATCH_TONE, PARTNER_INVOICE_TONE } from '@shared/ui/moneyTones'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const cycleLabel = (c: string) => {
  const [a, b] = c.split('/')
  return a === b ? formatDate(a) : `${formatDate(a).slice(0, 6)} – ${formatDate(b)}`
}
const NEEDS: PartnerInvoice['status'][] = ['disputed', 'matched', 'submitted']

export default function ERP32Payables() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const disputes = openDisputes(data, now)
  const invoices = Object.values(data.partnerInvoices).sort((a, b) => Number(NEEDS.includes(b.status)) - Number(NEEDS.includes(a.status)) || NEEDS.indexOf(a.status) - NEEDS.indexOf(b.status) || (b.date ?? b.cycle).localeCompare(a.date ?? a.cycle))
  const open = data.partnerInvoices[params.get('invoice') ?? '']
  if (open) return <MatchView inv={open} onBack={() => setParams({})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp32.title')} subtitle={t('erp32.subtitle', { hours: data.settings.partnerDisputeSlaHours })} className="mb-0" />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp32.disputes')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp32.disputes')}</h2>
        {disputes.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp32.noDisputes')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="disputes">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp32.col.invoice')}</th>
                <th>{t('erp32.col.partner')}</th>
                <th>{t('erp32.col.job')}</th>
                <th className="text-right">{t('erp32.col.diff')}</th>
                <th>{t('erp32.col.reason')}</th>
                <th className="text-right">{t('erp32.col.left')}</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={`${d.invoiceId}-${d.line.legId}`} className="border-b last:border-0" aria-label={`${d.invoiceId} ${d.line.legId}`}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ invoice: d.invoiceId })}>
                      {d.invoiceId}
                    </button>
                  </td>
                  <td>{data.partners[d.partnerId].shortName}</td>
                  <td className="tabular">{d.line.legId}</td>
                  <td className="tabular text-right">{formatINR(d.amount)}</td>
                  <td>
                    {d.line.dispute!.reason}
                    {d.line.dispute!.files.length > 0 && <span className="text-caption text-muted-foreground"> · {d.line.dispute!.files.join(', ')}</span>}
                  </td>
                  <td className={cn('tabular text-right', d.hoursLeft < 12 && 'font-semibold text-status-danger')}>{t('erp32.hoursLeft', { count: Math.max(0, d.hoursLeft) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <SelfBillingRun />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp32.invoices')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp32.invoices')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-invoices">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp32.col.invoice')}</th>
              <th>{t('erp32.col.partner')}</th>
              <th>{t('erp32.col.cycle')}</th>
              <th>{t('pp26.col.mode')}</th>
              <th className="text-right">{t('erp32.col.payable')}</th>
              <th>{t('pp26.col.match')}</th>
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
                <td>{data.partners[i.partnerId].shortName}</td>
                <td className="tabular">{cycleLabel(i.cycle)}</td>
                <td>{t(`pp26.mode.${i.mode}`)}</td>
                <td className="tabular text-right">{formatINR(invoicePayable(data, i))}</td>
                <td>
                  <Chip tone={MATCH_TONE[matchStatus(i)]}>{t(`pp26.match.${matchStatus(i)}`)}</Chip>
                </td>
                <td>
                  <Chip tone={PARTNER_INVOICE_TONE[i.status]}>{t(`pp26.status.${i.status}`)}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function SelfBillingRun() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const preview = selfBillingPreview(data, now)
  const cycles = [...new Set(preview.map((l) => l.cycle))]
  const [cycle, setCycle] = useState(cycles[0] ?? '')
  const [confirm, setConfirm] = useState(false)
  const lines = preview.filter((l) => l.cycle === (cycles.includes(cycle) ? cycle : cycles[0]))
  const total = lines.reduce((s, l) => s + l.total, 0)
  const run = () => {
    const ids = useDemoStore.getState().runSelfBilling(lines[0].cycle, user.id)
    toast.success(t('erp32.sb.done', { count: ids.length }))
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp32.sb.title')}>
      <h2 className="font-heading text-section font-semibold">{t('erp32.sb.title')}</h2>
      {!lines.length ? (
        <p className="text-muted-foreground">{t('erp32.sb.none')}</p>
      ) : (
        <>
          <Field label={t('erp32.sb.cycle')} htmlFor="sb-cycle" className="w-64">
            <NativeSelect id="sb-cycle" value={lines[0].cycle} onChange={(e) => setCycle(e.target.value)}>
              {cycles.map((c) => (
                <option key={c} value={c}>
                  {cycleLabel(c)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="self-billing">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp32.col.partner')}</th>
                <th className="text-right">{t('erp32.sb.legs')}</th>
                <th className="text-right">{t('erp31.run.taxable')}</th>
                <th className="text-right">{t('erp31.run.gst')}</th>
                <th className="text-right">{t('erp31.run.total')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.partnerId} className="border-b last:border-0" aria-label={data.partners[l.partnerId].shortName}>
                  <td className="py-2 font-medium">{data.partners[l.partnerId].shortName}</td>
                  <td className="tabular text-right">{l.legIds.length}</td>
                  <td className="tabular text-right">{formatINR(l.taxable)}</td>
                  <td className="tabular text-right">{formatINR(l.gst)}</td>
                  <td className="tabular text-right font-semibold">{formatINR(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button className="self-end" onClick={() => setConfirm(true)}>
            {t('erp32.sb.generate', { count: lines.length })}
          </Button>
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('erp32.sb.confirm', { count: lines.length })} body={t('erp32.sb.confirmBody', { amount: formatINR(total), cycle: cycleLabel(lines[0].cycle) })} confirmLabel={t('erp32.sb.generate', { count: lines.length })} onConfirm={run} />
        </>
      )}
    </section>
  )
}

function MatchView({ inv, onBack }: { inv: PartnerInvoice; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [confirm, setConfirm] = useState(false)
  const left = new Map(openDisputes(data, now).filter((d) => d.invoiceId === inv.id).map((d) => [d.line.legId, d.hoursLeft]))
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('erp32.back')}
      </button>
      <PageHeader
        title={`${inv.id} · ${data.partners[inv.partnerId].shortName}`}
        subtitle={t('erp32.headerSub', { cycle: cycleLabel(inv.cycle), mode: t(`pp26.mode.${inv.mode}`), payable: formatINR(invoicePayable(data, inv)) })}
        actions={
          inv.status === 'matched' && (
            <Button onClick={() => setConfirm(true)}>{t('erp32.approve')}</Button>
          )
        }
        className="mb-0"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={MATCH_TONE[matchStatus(inv)]}>{t(`pp26.match.${matchStatus(inv)}`)}</Chip>
        <Chip tone={PARTNER_INVOICE_TONE[inv.status]}>{t(`pp26.status.${inv.status}`)}</Chip>
        <span className="flex items-center gap-1 text-caption text-muted-foreground">
          {t('erp32.aiMatch')} <SimulatedTag />
        </span>
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
                <th>{t('erp32.col.decision')}</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.legId} className="border-b align-top last:border-0" aria-label={l.legId}>
                  <td className="tabular px-4 py-2">{l.legId}</td>
                  <td className="tabular">{t(`ponb.unit.${l.unit}`, { rate: formatINR(l.rate) })}</td>
                  <td className="tabular text-right">{formatKg(l.verifiedWeight)}</td>
                  <td>{l.pod ? <CheckCircle2 className="size-4 text-status-success" aria-label={t('pp26.podYes')} /> : <XCircle className="size-4 text-status-danger" aria-label={t('pp26.podNo')} />}</td>
                  <td className="tabular text-right">
                    {formatINR(l.billed)} / {formatINR(l.matched)}
                  </td>
                  <td>
                    <Chip tone={l.result === 'match' ? 'success' : 'warning'}>{lineResult(t, l)}</Chip>
                  </td>
                  <td className="py-2">
                    {l.dispute && !l.dispute.decision ? (
                      <Decide invoiceId={inv.id} line={l} hoursLeft={left.get(l.legId) ?? 0} />
                    ) : l.final !== undefined ? (
                      <span className="tabular">
                        {formatINR(l.final)}
                        {l.dispute?.decision && <span className="text-caption text-muted-foreground"> · {t(`erp32.decision.${l.dispute.decision}`)}</span>}
                        {l.partner === 'accepted' && <span className="text-caption text-muted-foreground"> · {t('erp32.partnerAccepted')}</span>}
                      </span>
                    ) : (
                      <span className="text-caption text-muted-foreground">{t('erp32.waitingPartner')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('erp32.confirmApprove', { amount: formatINR(invoicePayable(data, inv)) })}
        body={t('erp32.confirmBody')}
        confirmLabel={t('erp32.approve')}
        onConfirm={() => {
          useDemoStore.getState().approvePartnerInvoice(inv.id, user.id)
          toast.success(t('erp32.approved', { id: inv.id }))
        }}
      />
    </div>
  )
}

function Decide({ invoiceId, line: l, hoursLeft }: { invoiceId: string; line: PartnerInvoiceLine; hoursLeft: number }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const [decision, setDecision] = useState<'matched' | 'billed' | 'partial'>('matched')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const lo = Math.min(l.matched, l.billed)
  const hi = Math.max(l.matched, l.billed)
  const amt = Number(amount)
  const ok = decision !== 'partial' || (amt >= lo && amt <= hi && !!note.trim())
  return (
    <div className="flex w-80 flex-col gap-2" data-testid="decide">
      <p className="text-caption">
        <span className="font-medium">{t('erp32.partnerSays')}</span> {l.dispute!.reason}
        <span className={cn('ml-1 tabular', hoursLeft < 12 && 'font-semibold text-status-danger')}>· {t('erp32.hoursLeft', { count: Math.max(0, hoursLeft) })}</span>
      </p>
      <RadioGroup value={decision} onValueChange={(v) => setDecision(v as typeof decision)} aria-label={t('erp32.col.decision')} className="gap-1">
        {(['matched', 'billed', 'partial'] as const).map((d) => (
          <label key={d} className="flex items-center gap-2 text-caption">
            <RadioGroupItem value={d} aria-label={t(`erp32.decision.${d}`)} /> {t(`erp32.decision.${d}`)}
            {d === 'matched' && <span className="tabular text-muted-foreground">{formatINR(l.matched)}</span>}
            {d === 'billed' && <span className="tabular text-muted-foreground">{formatINR(l.billed)}</span>}
          </label>
        ))}
      </RadioGroup>
      {decision === 'partial' && (
        <Field label={t('erp32.partialAmount', { lo: formatINR(lo), hi: formatINR(hi) })} htmlFor={`pa-${l.legId}`} small>
          <Input id={`pa-${l.legId}`} type="number" className="tabular h-8" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      <Field label={t('erp32.note')} htmlFor={`pn-${l.legId}`} small required={decision === 'partial'}>
        <Input id={`pn-${l.legId}`} className="h-8" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        size="sm"
        className="self-start"
        disabled={!ok}
        onClick={() => {
          useDemoStore.getState().resolvePartnerDispute(invoiceId, l.legId, { decision, amount: decision === 'partial' ? amt : undefined, note }, user.id)
          toast.success(t('erp32.resolved'))
        }}
      >
        {t('erp32.resolve')}
      </Button>
    </div>
  )
}
