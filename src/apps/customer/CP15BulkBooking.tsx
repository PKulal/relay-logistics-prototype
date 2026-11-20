/**
 * CP-15 Bulk booking (Excel upload) — docs/01-customer-portal.md. Source §7.2
 * (Bulk Booking: Excel upload, multi-piece booking, saved consignees and SKU
 * dimensions), §7 Step 2. Each valid row is booked exactly like CP-13; error
 * rows stay for fixing. A sample file is offered for the demo.
 */
import { Download, FileSpreadsheet, Pencil, Printer, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { bookableLocations } from '@shared/engines/customerSettings'
import { pickupDates } from '@shared/engines/schedule'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { KpiTile } from '@shared/ui/KpiTile'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { consigneeFor, toBookingInput } from './bookingForm'
import { checkRow, downloadBulkTemplate, downloadErrorFile, MAX_MB, MAX_ROWS, readBulkFile, sampleRows, summary, type BulkRow, type CheckedRow } from './bulkBooking'
import { usePrintShipments } from './shipmentFiles'
import { useCustomerSession } from './useCustomerSession'

const TONE = { valid: 'success', warning: 'warning', error: 'danger' } as const
const EDITABLE: (keyof BulkRow)[] = ['consignee', 'contact', 'mobile', 'address', 'pincode', 'pieces', 'l', 'b', 'h', 'weight', 'invoiceNo', 'invoiceValue', 'ewbNo']

export default function CP15BulkBooking() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const locations = bookableLocations(data, customer, user)
  const dates = pickupDates(now, data.settings.pickupCutoff)
  const [locationId, setLocationId] = useState(locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? '')
  const [date, setDate] = useState(dates[0])
  const [file, setFile] = useState('')
  const [rows, setRows] = useState<BulkRow[]>([])
  const [editing, setEditing] = useState<number>()
  const [confirm, setConfirm] = useState(false)
  const [booked, setBooked] = useState<string[]>([])
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const print = usePrintShipments(data)
  const checked: CheckedRow[] = rows.map((r, i) => checkRow(data, customer, user, r, i, locationId, date, now))
  const sum = summary(checked)
  const history = Object.values(data.bulkBatches)
    .filter((b) => b.customerId === customer.id)
    .sort((a, b) => b.at.localeCompare(a.at))
  const message = (r: CheckedRow) => (r.issues.length ? r.issues.map((i) => t(`cp15.issue.${i}`, { code: r.quote && !r.quote.ok ? r.quote.code : '' })).join(' · ') : t('cp15.ok'))

  const load = async (f?: File) => {
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(t('cp15.tooBig', { mb: MAX_MB }))
    const r = await readBulkFile(f)
    setFile(f.name)
    setRows(r)
    setBooked([])
    toast.success(t('cp15.loaded', { count: r.length }))
    if (input.current) input.current.value = ''
  }

  const bookValid = () => {
    const store = useDemoStore.getState
    const lrs: string[] = []
    const left: BulkRow[] = []
    for (const r of checked) {
      if (r.status === 'error') {
        left.push(r.row)
        continue
      }
      try {
        // Fresh data per row: consignee numbers and LRs move on as rows are booked
        const { consignee, isNew } = consigneeFor(store().data, customer.id, r.form)
        if (isNew) store().saveConsignee(consignee)
        lrs.push(store().bookShipment({ ...toBookingInput(r.form, customer.id, user, consignee.id), bulk: true }))
      } catch {
        left.push(r.row)
      }
    }
    store().recordBulkBatch(customer.id, file || t('cp15.sampleName'), rows.length, lrs, left.length, user.id)
    setBooked(lrs)
    setRows(left)
    setConfirm(false)
    toast.success(t('cp15.booked', { count: lrs.length, left: left.length }))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp15.title')}
        subtitle={t('cp15.subtitle', { rows: MAX_ROWS, mb: MAX_MB })}
        actions={
          <Button variant="outline" onClick={downloadBulkTemplate}>
            <Download /> {t('cp15.template')}
          </Button>
        }
        className="mb-0"
      />

      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card md:grid-cols-[1fr_1fr_2fr]" aria-label={t('cp15.upload')}>
        <Field label={t('cp15.location')} htmlFor="b-loc" required>
          <NativeSelect id="b-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp15.date')} htmlFor="b-date" required>
          <NativeSelect id="b-date" value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void load(e.dataTransfer.files[0])
          }}
          className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center', drag && 'border-primary bg-primary-soft')}
        >
          <FileSpreadsheet className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-caption">{file ? t('cp15.file', { name: file, count: rows.length }) : t('cp15.drop')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
              <Upload /> {t('cp15.choose')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (setRows(sampleRows()), setFile(t('cp15.sampleName')), setBooked([]))}>
              {t('cp15.sample')}
            </Button>
          </div>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label={t('cp15.choose')} onChange={(e) => void load(e.target.files?.[0])} />
        </div>
      </section>

      {booked.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-status-success bg-status-success-bg p-4" aria-label={t('cp15.bookedTitle')}>
          <p className="flex-1">{t('cp15.bookedLine', { count: booked.length, lrs: booked.join(', ') })}</p>
          <Button variant="outline" onClick={() => print.print('labels', booked.map((lr) => data.shipments[lr]).filter(Boolean))}>
            <Printer /> {t('cp15.labels')}
          </Button>
          <Link to="/customer/shipments" className="text-primary hover:underline">
            {t('cp15.toShipments')}
          </Link>
        </section>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-5" data-testid="bulk-summary">
            <KpiTile label={t('cp15.valid')} value={String(sum.valid)} />
            <KpiTile label={t('cp15.warnings')} value={String(sum.warnings)} />
            <KpiTile label={t('cp15.errors')} value={String(sum.errors)} />
            <KpiTile label={t('cp15.weight')} value={formatKg(sum.weight)} />
            <KpiTile label={t('cp15.total')} value={formatINR(sum.total)} />
          </div>
          <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="bulk-rows">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('cp15.col.row')}</th>
                  <th>{t('cp15.col.consignee')}</th>
                  <th>{t('cp15.col.status')}</th>
                  <th>{t('cp15.col.message')}</th>
                  <th>{t('cp15.col.price')}</th>
                  <th className="sr-only">{t('cp15.col.fix')}</th>
                </tr>
              </thead>
              <tbody>
                {checked.map((r) => (
                  <tr key={r.index} className="border-b last:border-0" aria-label={`${t('cp15.col.row')} ${r.index + 1}`}>
                    <td className="tabular px-4 py-2">{r.index + 1}</td>
                    <td>
                      {r.row.consignee || '—'} <span className="tabular text-caption text-muted-foreground">/ {r.row.pincode || '—'}</span>
                    </td>
                    <td>
                      <Chip tone={TONE[r.status]}>{t(`cp15.st.${r.status}`)}</Chip>
                    </td>
                    <td className="text-caption">{message(r)}</td>
                    <td className="tabular">{r.quote?.ok ? formatINR(r.quote.quote.price.total) : '—'}</td>
                    <td className="py-1.5 text-right">
                      <Button size="sm" variant="ghost" aria-label={t('cp15.fixRow', { n: r.index + 1 })} onClick={() => setEditing(r.index)}>
                        <Pencil />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button disabled={sum.valid + sum.warnings === 0} onClick={() => setConfirm(true)}>
              {t('cp15.book', { count: sum.valid + sum.warnings })}
            </Button>
            <Button variant="outline" disabled={sum.errors + sum.warnings === 0} onClick={() => downloadErrorFile(checked, message)}>
              <Download /> {t('cp15.errorFile')}
            </Button>
          </div>
        </>
      )}

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('cp15.history')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('cp15.history')}</h2>
        {history.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('cp15.noHistory')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="bulk-history">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp15.col.date')}</th>
                <th>{t('cp15.col.file')}</th>
                <th>{t('cp15.col.rows')}</th>
                <th>{t('cp15.col.booked')}</th>
                <th>{t('cp15.col.errors')}</th>
                <th>{t('cp15.col.user')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="tabular px-4 py-2">{formatDateTime(b.at)}</td>
                  <td>{b.file}</td>
                  <td className="tabular">{b.rows}</td>
                  <td className="tabular">{b.booked}</td>
                  <td className="tabular">{b.errors}</td>
                  <td>{data.customerUsers[b.by]?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing !== undefined && rows[editing] && (
        <FixDialog
          row={rows[editing]}
          n={editing + 1}
          onClose={() => setEditing(undefined)}
          onSave={(r) => {
            setRows(rows.map((x, i) => (i === editing ? r : x)))
            setEditing(undefined)
          }}
        />
      )}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('cp15.confirmTitle', { count: sum.valid + sum.warnings })} body={t('cp15.confirmBody', { total: formatINR(sum.total) })} confirmLabel={t('cp15.confirm')} onConfirm={bookValid} />
      {print.view}
    </div>
  )
}

function FixDialog({ row, n, onClose, onSave }: { row: BulkRow; n: number; onClose: () => void; onSave: (r: BulkRow) => void }) {
  const { t } = useTranslation()
  const [r, setR] = useState(row)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('cp15.fixRow', { n })}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {EDITABLE.map((k) => (
            <Field key={k} label={t(`cp15.f.${k}`)} htmlFor={`fx-${k}`} small>
              <Input id={`fx-${k}`} value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave(r)}>{t('cp15.revalidate')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
