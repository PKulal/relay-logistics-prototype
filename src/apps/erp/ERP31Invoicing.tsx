/**
 * ERP-31 Customer invoicing and collections — docs/04-erp-control-tower.md.
 * Tabs: invoice runs and collections (ERP31Receivables.tsx), and weight
 * disputes (source §7 Step 4: the customer disputes a weight revision; Logisco
 * reviews and responds).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { WeightRevision } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import { WeightEvidence } from '@shared/ui/WeightEvidence'
import { Collections, InvoiceRuns } from './ERP31Receivables'
import { useErpSession } from './useErpSession'

type Tab = 'runs' | 'collections' | 'weight'
const TABS: Tab[] = ['runs', 'collections', 'weight']

export default function ERP31Invoicing() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const open = useData((d) => Object.values(d.weightRevisions).filter((w) => w.status === 'disputed').length)
  const asked = params.get('tab') as Tab | null
  const tab: Tab = asked && TABS.includes(asked) ? asked : params.get('wr') ? 'weight' : 'runs'
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp31.title')} subtitle={t('erp31.lead')} className="mb-0" />
      <div role="tablist" aria-label={t('erp31.title')} className="flex gap-2 border-b">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'runs' ? {} : { tab: k })} className={cn('px-3 pb-2 font-medium text-muted-foreground', tab === k && 'border-b-2 border-primary font-semibold text-foreground')}>
            {t(`erp31.tab.${k}`)}
            {k === 'weight' && <span className="tabular ml-1 text-caption text-muted-foreground">{open}</span>}
          </button>
        ))}
      </div>
      {tab === 'runs' && <InvoiceRuns />}
      {tab === 'collections' && <Collections />}
      {tab === 'weight' && <WeightDisputes />}
    </div>
  )
}

/** Weight disputes (source §7 Step 4): the customer disputes a revision; Finance decides. */
function WeightDisputes() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  // Disputes waiting for Finance first, then decided ones
  const list = Object.values(data.weightRevisions)
    .filter((w) => w.dispute)
    .sort((a, b) => Number(b.status === 'disputed') - Number(a.status === 'disputed') || b.dispute!.at.localeCompare(a.dispute!.at))
  const selected = data.weightRevisions[params.get('wr') ?? ''] ?? list[0]
  return (
    <>
      {list.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('erp31.empty')}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label={t('erp31.tab.weight')}>
            {list.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => setParams({ tab: 'weight', wr: w.id })}
                  aria-current={selected?.id === w.id ? 'true' : undefined}
                  className={cn('flex w-full flex-col gap-1 rounded-lg border bg-card p-3 text-left hover:border-primary', selected?.id === w.id && 'border-primary bg-primary-soft')}
                >
                  <span className="tabular font-medium">{w.shipmentId}</span>
                  <span className="text-caption text-muted-foreground">
                    {data.customers[data.shipments[w.shipmentId].customerId].shortName} · {formatINR(w.amountDiff)}
                  </span>
                  <Chip tone={w.status === 'disputed' ? 'warning' : 'neutral'} className="self-start">
                    {t(`cp20.status.${w.status}`)}
                  </Chip>
                </button>
              </li>
            ))}
          </ul>
          {selected && <Dispute key={selected.id} revision={selected} />}
        </div>
      )}
    </>
  )
}

function Dispute({ revision: w }: { revision: WeightRevision }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const s = data.shipments[w.shipmentId]
  const c = data.customers[s.customerId]
  const [decision, setDecision] = useState<'upheld' | 'reversed'>('upheld')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const d = w.dispute!
  const canDecide = user.role === 'finance' && w.status === 'disputed'
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-label={w.shipmentId}>
        <h2 className="text-card-title">
          <Link to={`/erp/shipments/${s.id}`} className="tabular text-primary hover:underline">
            {s.id}
          </Link>{' '}
          · {c.legalName}
        </h2>
        <p className="text-caption text-muted-foreground">{t(`erp31.billing.${c.billing}`)}</p>
        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-table" data-testid="customer-dispute">
          <p className="font-medium">
            {t('erp31.disputedBy', { name: data.customerUsers[d.by]?.name ?? '', at: formatDateTime(d.at) })} · {t(`cp20.reasons.${d.reason}`)}
          </p>
          <p>{d.remarks}</p>
          {d.files.length > 0 && <p className="text-caption text-muted-foreground">{d.files.join(', ')}</p>}
        </div>
      </section>
      <WeightEvidence shipment={s} revision={w} />
      {w.resolution ? (
        <p className="rounded-xl border bg-card p-5 font-medium" data-testid="resolution">
          {t(`erp31.decided.${w.resolution.decision}`, { name: data.staff[w.resolution.by]?.name ?? '', at: formatDateTime(w.resolution.at) })} {w.resolution.note}
        </p>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dec-h">
          <h3 id="dec-h" className="font-semibold">
            {t('erp31.decision')}
          </h3>
          <RadioGroup value={decision} onValueChange={(v) => setDecision(v as typeof decision)} className="flex flex-col gap-2" aria-label={t('erp31.decision')}>
            <label className="flex items-start gap-2">
              <RadioGroupItem value="upheld" className="mt-0.5" /> {t('erp31.uphold', { kg: w.verified, amount: formatINR(w.amountDiff) })}
            </label>
            <label className="flex items-start gap-2">
              <RadioGroupItem value="reversed" className="mt-0.5" /> {t('erp31.reverse', { kg: w.booked })}
            </label>
          </RadioGroup>
          <Field label={t('erp31.note')} htmlFor="e31-note" required hint={t('erp31.noteHint')}>
            <textarea id="e31-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-body" />
          </Field>
          <Button className="self-start" disabled={!canDecide || !note.trim()} onClick={() => setConfirm(true)}>
            {t('erp31.save')}
          </Button>
          {user.role !== 'finance' && <p className="text-caption text-muted-foreground">{t('erp31.financeOnly')}</p>}
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={decision === 'upheld' ? t('erp31.confirmUphold', { amount: formatINR(w.amountDiff) }) : t('erp31.confirmReverse')}
            body={decision === 'upheld' ? t(`erp31.charge.${c.billing}`) : t('erp31.reverseBody')}
            confirmLabel={t('erp31.save')}
            onConfirm={() => {
              useDemoStore.getState().resolveDispute(w.id, decision, note, user.id)
              toast.success(t('erp31.saved'))
            }}
          />
        </section>
      )}
    </div>
  )
}
