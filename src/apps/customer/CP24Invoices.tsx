/**
 * CP-24 Invoices, credit notes and ledger — docs/01-customer-portal.md. Source
 * §7 Step 11, §9 Customer Invoicing (GST invoice per shipment or monthly, e-POD
 * attached, e-invoice), §7.2 (credit limit, invoices, credit notes, payment
 * links, ledger). "Raise billing query" is not in the client document.
 */
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { creditSummary, customerInvoices, invoiceStatus, ledger } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { DemoData, Invoice } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { EmptyState } from '@shared/ui/EmptyState'
import { AccessDenied, PageHeader } from '@shared/ui/Page'
import { PaymentGateway } from '@shared/ui/PaymentGateway'
import { Chip } from '@shared/ui/StatusChip'
import { INVOICE_TONE } from '@shared/ui/moneyTones'
import { exportInvoiceLines } from './moneyFiles'
import { useCustomerSession } from './useCustomerSession'

const TABS = ['invoices', 'creditNotes', 'ledger'] as const
type Tab = (typeof TABS)[number]

const monthLabel = (period: string) => formatDate(`${period}-01`).slice(3)

export default function CP24Invoices() {
  const { t } = useTranslation()
  const { customer, user } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const [paying, setPaying] = useState(false)
  if (user.role === 'dispatch') return <AccessDenied />
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'invoices'
  const invoices = customerInvoices(data, customer.id)
  const credit = customer.billing === 'credit' ? creditSummary(data, customer, now) : undefined
  const open = params.get('invoice') ? data.invoices[params.get('invoice')!] : undefined
  const chosen = selected.map((id) => data.invoices[id]).filter((i) => i && i.status !== 'paid')
  const payTotal = chosen.reduce((s, i) => s + i.total, 0)

  if (open && open.customerId === customer.id) return <InvoiceDetail inv={open} data={data} onBack={() => setParams({})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cp24.title')} subtitle={t('cp24.subtitle')} className="mb-0" />
      {credit && (
        <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-3" aria-label={t('cp24.credit')} data-testid="credit">
          <Fact label={t('cp24.limitUsedAvailable')} value={`${formatINR(credit.limit)} / ${formatINR(credit.used)} / ${formatINR(credit.available)}`} />
          <Fact label={t('cp24.terms')} value={t('cp24.termsDays', { count: credit.termsDays })} />
          <Fact label={t('cp24.overdue')} value={formatINR(credit.overdue)} danger={credit.overdue > 0} />
        </section>
      )}
      {credit && credit.overdue > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-status-danger bg-status-danger-bg p-3 font-medium text-status-danger" role="alert">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {t('cp24.overdueBanner', { amount: formatINR(credit.overdue) })}
        </p>
      )}

      <div role="tablist" aria-label={t('cp24.title')} className="flex gap-2 border-b">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'invoices' ? {} : { tab: k })} className={cn('px-3 pb-2 font-medium text-muted-foreground', tab === k && 'border-b-2 border-primary font-semibold text-foreground')}>
            {t(`cp24.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'invoices' &&
        (invoices.length === 0 ? (
          <EmptyState title={t('cp24.empty')} className="rounded-xl border bg-card" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
              <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="invoices">
                <thead>
                  <tr className="border-b text-left text-caption text-muted-foreground">
                    <th className="w-10 px-4 py-2">
                      <span className="sr-only">{t('cp24.select')}</span>
                    </th>
                    <th>{t('cp24.col.no')}</th>
                    <th>{t('cp24.col.date')}</th>
                    <th className="text-right">{t('cp24.col.shipments')}</th>
                    <th className="text-right">{t('cp24.col.amounts')}</th>
                    <th>{t('cp24.col.due')}</th>
                    <th>{t('cp24.col.status')}</th>
                    <th>{t('cp24.col.irn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const st = invoiceStatus(i, now)
                    return (
                      <tr key={i.id} className="border-b last:border-0" aria-label={i.id}>
                        <td className="px-4 py-2">
                          {st !== 'paid' && <Checkbox aria-label={t('cp24.selectInvoice', { id: i.id })} checked={selected.includes(i.id)} onCheckedChange={(v) => setSelected(v === true ? [...selected, i.id] : selected.filter((x) => x !== i.id))} />}
                        </td>
                        <td>
                          <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ invoice: i.id })}>
                            {i.id}
                          </button>
                        </td>
                        <td className="tabular">
                          {formatDate(i.date)} / {monthLabel(i.period)}
                        </td>
                        <td className="tabular text-right">{i.shipmentCount}</td>
                        <td className="tabular text-right">
                          {formatINR(i.taxable)} / {formatINR(i.gst)} / <span className="font-semibold">{formatINR(i.total)}</span>
                        </td>
                        <td className={cn('tabular', st === 'overdue' && 'font-semibold text-status-danger')}>{formatDate(i.dueDate)}</td>
                        <td>
                          <Chip tone={INVOICE_TONE[st]}>{t(`cp24.status.${st}`)}</Chip>
                        </td>
                        <td>{i.irn ? <CheckCircle2 className="size-4 text-status-success" aria-label={t('cp24.irnYes')} /> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              {chosen.length > 0 && <span className="tabular text-muted-foreground">{t('cp24.selected', { count: chosen.length, amount: formatINR(payTotal) })}</span>}
              <Button disabled={!chosen.length} onClick={() => setPaying(true)}>
                {t('cp24.payNow')}
              </Button>
            </div>
            <PaymentGateway
              key={String(paying)}
              open={paying}
              onOpenChange={setPaying}
              amount={payTotal}
              purpose={chosen.map((i) => i.id).join(', ')}
              onSuccess={(m) => {
                const ref = useDemoStore.getState().payInvoices(
                  chosen.map((i) => i.id),
                  m,
                  user.id,
                )
                if (ref) {
                  toast.success(t('cp24.paid', { amount: formatINR(payTotal), ref }))
                  setSelected([])
                }
              }}
              onFailure={() => toast.error(t('pay.failed'))}
            />
          </>
        ))}

      {tab === 'creditNotes' && <CreditNotes data={data} customerId={customer.id} />}
      {tab === 'ledger' && <Ledger data={data} customerId={customer.id} />}
    </div>
  )
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className={cn('tabular font-semibold', danger && 'text-status-danger')}>{value}</p>
    </div>
  )
}

function CreditNotes({ data, customerId }: { data: DemoData; customerId: string }) {
  const { t } = useTranslation()
  const notes = Object.values(data.creditNotes)
    .filter((c) => c.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!notes.length) return <EmptyState title={t('cp24.noCreditNotes')} className="rounded-xl border bg-card" />
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="credit-notes">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="px-4 py-2">{t('cp24.cn.no')}</th>
            <th>{t('cp24.cn.date')}</th>
            <th>{t('cp24.cn.reason')}</th>
            <th className="text-right">{t('cp24.cn.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((c) => (
            <tr key={c.id} className="border-b last:border-0" aria-label={c.id}>
              <td className="tabular px-4 py-2 font-medium">{c.id}</td>
              <td className="tabular">{formatDate(c.date)}</td>
              <td>
                {c.claimId ? (
                  <>
                    {t('cp24.cn.claim')} ·{' '}
                    <Link to={`/customer/claims/${c.claimId}`} className="tabular text-primary hover:underline">
                      {c.claimId}
                    </Link>
                  </>
                ) : (
                  c.reason
                )}
              </td>
              <td className="tabular text-right">{formatINR(c.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Ledger({ data, customerId }: { data: DemoData; customerId: string }) {
  const { t } = useTranslation()
  const rows = ledger(data, customerId)
  if (!rows.length) return <EmptyState title={t('cp24.noLedger')} className="rounded-xl border bg-card" />
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="ledger">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="px-4 py-2">{t('cp24.lg.date')}</th>
            <th>{t('cp24.lg.type')}</th>
            <th>{t('cp24.lg.no')}</th>
            <th className="text-right">{t('cp24.lg.debit')}</th>
            <th className="text-right">{t('cp24.lg.credit')}</th>
            <th className="text-right">{t('cp24.lg.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n} className="border-b last:border-0" aria-label={r.no}>
              <td className="tabular px-4 py-2">{formatDate(r.date)}</td>
              <td>{t(`cp24.lg.kind.${r.kind}`)}</td>
              <td className="tabular">{r.no}</td>
              <td className="tabular text-right">{r.debit ? formatINR(r.debit) : ''}</td>
              <td className="tabular text-right">{r.credit ? formatINR(r.credit) : ''}</td>
              <td className="tabular text-right font-medium">{formatINR(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Invoice detail: one line per shipment with its e-POD (source §9). */
function InvoiceDetail({ inv, data, onBack }: { inv: Invoice; data: DemoData; onBack: () => void }) {
  const { t } = useTranslation()
  const now = useDemoNow()
  const st = invoiceStatus(inv, now)
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('cp24.back')}
      </button>
      <PageHeader
        title={inv.id}
        subtitle={t('cp24.detailSub', { period: monthLabel(inv.period), date: formatDate(inv.date), due: formatDate(inv.dueDate) })}
        actions={
          inv.lrs?.length ? (
            <Button variant="outline" onClick={() => exportInvoiceLines(data, inv, t)}>
              <FileSpreadsheet /> {t('cp24.linesExcel')}
            </Button>
          ) : undefined
        }
        className="mb-0"
      />
      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-4" data-testid="invoice-summary">
        <Fact label={t('cp24.col.shipments')} value={String(inv.shipmentCount)} />
        <Fact label={t('cp24.taxableGst')} value={`${formatINR(inv.taxable)} + ${formatINR(inv.gst)}`} />
        <Fact label={t('cp24.total')} value={formatINR(inv.total)} />
        <div>
          <p className="text-caption text-muted-foreground">{t('cp24.col.status')}</p>
          <Chip tone={INVOICE_TONE[st]}>{t(`cp24.status.${st}`)}</Chip>
        </div>
        {inv.irn && <Fact label={t('cp24.irn')} value={inv.irn} />}
        {inv.payment && <Fact label={t('cp24.paidOn')} value={`${formatDateTime(inv.payment.at)} · ${t(`pay.m.${inv.payment.method}`)} · ${inv.payment.ref}`} />}
      </section>
      {inv.lrs?.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="invoice-lines">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp24.line.lr')}</th>
                <th>{t('cp24.line.date')}</th>
                <th>{t('cp24.line.lane')}</th>
                <th className="text-right">{t('cp24.line.weight')}</th>
                <th className="text-right">{t('cp24.line.taxable')}</th>
                <th className="text-right">{t('cp24.line.gst')}</th>
                <th className="text-right">{t('cp24.line.total')}</th>
                <th>{t('cp24.line.pod')}</th>
              </tr>
            </thead>
            <tbody>
              {inv.lrs.map((lr) => {
                const s = data.shipments[lr]
                return (
                  <tr key={lr} className="border-b last:border-0" aria-label={lr}>
                    <td className="tabular px-4 py-2">{lr}</td>
                    <td className="tabular">{formatDate(s.bookedAt)}</td>
                    <td>
                      {data.pincodes[s.originPincode].city} → {data.pincodes[s.destPincode].city}
                    </td>
                    <td className="tabular text-right">{formatKg(s.weights.verifiedChargeable ?? s.weights.chargeable)}</td>
                    <td className="tabular text-right">{formatINR(s.price.subtotal)}</td>
                    <td className="tabular text-right">{formatINR(s.price.gst)}</td>
                    <td className="tabular text-right">{formatINR(s.price.total)}</td>
                    <td>
                      <Link to={`/customer/shipments/${lr}`} className="text-primary hover:underline">
                        {t('cp24.line.podLink')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">{t('cp24.noLines', { count: inv.shipmentCount })}</p>
      )}
    </div>
  )
}
