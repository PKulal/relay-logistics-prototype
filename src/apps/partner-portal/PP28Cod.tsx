/**
 * PP-28 COD deposits — docs/02-partner-portal.md. Source §9 COD Handling:
 * the partner deposits COD within 24 hours; shortages are deducted from the
 * payout with evidence. Riders hand cash to the office in the Partner App
 * (PA-36); the office deposits it into Logisco's collection account here.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { partnerCodOutstanding } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { addDaysToDate, istDate, isBefore } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { CodRecord } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { KpiTile } from '@shared/ui/KpiTile'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { usePartnerSession } from './usePartnerSession'

type Stage = 'withRider' | 'atOffice' | 'deposited' | 'short'
const stageOf = (r: CodRecord): Stage => (r.shortage ? 'short' : r.status === 'collected' ? 'withRider' : r.status === 'atOffice' ? 'atOffice' : 'deposited')
const STAGE_TONE: Record<Stage, Tone> = { withRider: 'warning', atOffice: 'warning', deposited: 'success', short: 'danger' }
const METHODS = ['bankTransfer', 'cashSlip', 'upi'] as const

export default function PP28Cod() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const out = partnerCodOutstanding(data, partner.id)
  const since = addDaysToDate(istDate(now), -3)
  const records = Object.values(data.codRecords)
    .filter((r) => r.partnerId === partner.id && (r.status === 'collected' || r.status === 'atOffice' || (r.collectedAt && istDate(r.collectedAt) >= since)))
    .sort((a, b) => (b.collectedAt ?? '').localeCompare(a.collectedAt ?? ''))
  const atOffice = records.filter((r) => r.status === 'atOffice' && !r.shortage)
  const [method, setMethod] = useState<(typeof METHODS)[number]>('bankTransfer')
  const [picked, setPicked] = useState<string[]>([])
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [slip, setSlip] = useState('')
  const [tried, setTried] = useState(false)
  const sum = atOffice.filter((r) => picked.includes(r.id)).reduce((s, r) => s + r.amount, 0)
  const req = t('cp04.err.required')
  const errors = {
    picked: !picked.length ? t('pp28.err.pick') : undefined,
    amount: !(Number(amount) > 0) ? req : Number(amount) !== sum ? t('pp28.err.sum', { sum: formatINR(sum) }) : undefined,
    ref: method === 'cashSlip' ? (!slip ? req : undefined) : !ref.trim() ? req : undefined,
  }
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined)
  const submit = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return toast.error(t('cp04.fix'))
    useDemoStore.getState().recordPartnerCodDeposit(partner.id, { method, amount: Number(amount), ref: method === 'cashSlip' ? `${ref.trim() || 'Slip'} · ${slip}` : ref, recordIds: picked }, user.id)
    toast.success(t('pp28.done', { amount: formatINR(sum) }))
    setPicked([])
    setAmount('')
    setRef('')
    setSlip('')
    setTried(false)
  }
  const late = !!out.dueBy && isBefore(out.dueBy, now)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp28.title')} subtitle={t('pp28.subtitle')} className="mb-0" />
      <div className="grid gap-4 sm:grid-cols-2" data-testid="cod-outstanding">
        <KpiTile label={t('pp28.outstanding')} value={formatINR(out.amount)} hint={out.oldest ? t('pp28.oldest', { at: formatDateTime(out.oldest) }) : undefined} />
        <KpiTile label={t('pp28.dueBy')} value={out.dueBy ? formatDateTime(out.dueBy) : '—'} hint={late ? t('pp28.late') : undefined} hintTone={late ? 'danger' : 'neutral'} />
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp28.collections')}</h2>
        {records.length === 0 ? (
          <EmptyState title={t('pp28.empty')} />
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="cod-collections">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp28.col.lr')}</th>
                <th>{t('pp28.col.rider')}</th>
                <th className="text-right">{t('pp28.col.amount')}</th>
                <th>{t('pp28.col.collected')}</th>
                <th>{t('pp28.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b last:border-0" aria-label={r.shipmentId}>
                  <td className="tabular px-4 py-2">{r.shipmentId}</td>
                  <td>{r.collectedBy ? (data.fieldStaff[r.collectedBy]?.name ?? '—') : '—'}</td>
                  <td className="tabular text-right">{formatINR(r.amount)}</td>
                  <td className="tabular">{r.collectedAt ? formatDateTime(r.collectedAt) : '—'}</td>
                  <td>
                    <Chip tone={STAGE_TONE[stageOf(r)]}>{t(`pp28.stage.${stageOf(r)}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp28.record')}>
        <h2 className="font-heading text-section font-semibold">{t('pp28.record')}</h2>
        {atOffice.length === 0 ? (
          <p className="text-muted-foreground">{t('pp28.nothingAtOffice')}</p>
        ) : (
          <>
            <fieldset>
              <legend className="mb-2 font-medium">
                {t('pp28.covered')} <span className="text-status-danger">*</span>
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('pp28.covered')}>
                {atOffice.map((r) => (
                  <label key={r.id} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption', picked.includes(r.id) && 'border-primary bg-primary-soft')}>
                    <Checkbox
                      aria-label={r.shipmentId}
                      checked={picked.includes(r.id)}
                      onCheckedChange={(v) => {
                        const next = v === true ? [...picked, r.id] : picked.filter((x) => x !== r.id)
                        setPicked(next)
                        setAmount(String(atOffice.filter((x) => next.includes(x.id)).reduce((s, x) => s + x.amount, 0) || ''))
                      }}
                    />
                    <span className="tabular">
                      {r.shipmentId} · {formatINR(r.amount)}
                    </span>
                  </label>
                ))}
              </div>
              {err('picked') && <p className="mt-1 text-caption font-medium text-status-danger">{err('picked')}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-medium">{t('pp28.method')}</legend>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as (typeof METHODS)[number])} className="flex flex-wrap gap-4" aria-label={t('pp28.method')}>
                {METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <RadioGroupItem value={m} aria-label={t(`pp28.m.${m}`)} /> {t(`pp28.m.${m}`)}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('pp28.amount')} htmlFor="cd-amt" required error={err('amount')}>
                <Input id="cd-amt" type="number" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              {method === 'cashSlip' ? (
                <Field label={t('pp28.slip')} htmlFor="cd-slip" required error={err('ref')} hint={slip || undefined}>
                  <Input id="cd-slip" type="file" onChange={(e) => setSlip(e.target.files?.[0]?.name ?? '')} />
                </Field>
              ) : (
                <Field label={t(method === 'upi' ? 'pp28.upiRef' : 'pp28.utr')} htmlFor="cd-ref" required error={err('ref')}>
                  <Input id="cd-ref" className="tabular" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} />
                </Field>
              )}
            </div>
            <Button className="self-start" onClick={submit}>
              {t('pp28.submit')}
            </Button>
          </>
        )}
        <p className="text-caption text-muted-foreground">{t('pp28.rule')}</p>
      </section>
    </div>
  )
}
