/**
 * ERP-34 COD reconciliation — docs/04-erp-control-tower.md. Source §9 COD
 * Handling: rider collects → partner deposits within 24 h → remitted to the
 * shipper at T+2; shortages deducted from the partner with evidence.
 * Remittance batches are maker-checker: Finance creates, Leadership approves.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { depositedNotRemitted, notDeposited, shortages } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { CodRecord, CodRemittance } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { REMITTANCE_TONE } from '@shared/ui/moneyTones'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const CHECKER_ROLES = ['leadership', 'superAdmin']

export default function ERP34CodRecon() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const held = notDeposited(data, now)
  const deposited = depositedNotRemitted(data)
  const batches = Object.values(data.codRemittances).sort((a, b) => Number(b.status !== 'remitted') - Number(a.status !== 'remitted') || b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const short = shortages(data)
  const [shortFor, setShortFor] = useState<CodRecord[]>()
  const [approve, setApprove] = useState<CodRemittance>()
  const isChecker = CHECKER_ROLES.includes(user.role)
  const name = (id?: string) => (id ? data.staff[id]?.name ?? id : '—')

  const createBatch = (customerId: string) => {
    const id = useDemoStore.getState().createRemittanceBatch(customerId, user.id)
    if (id) toast.success(t('erp34.batchCreated', { id }))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp34.title')} subtitle={t('erp34.subtitle', { hours: data.settings.codDepositHours })} className="mb-0" />

      <Panel title={t('erp34.held')} empty={held.length === 0} emptyText={t('erp34.heldEmpty')}>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="not-deposited">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp34.col.partner')}</th>
              <th>{t('erp34.col.lrs')}</th>
              <th className="text-right">{t('erp34.col.amount')}</th>
              <th className="text-right">{t('erp34.col.hours')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {held.map((h) => (
              <tr key={h.partnerId} className="border-b last:border-0" aria-label={data.partners[h.partnerId].shortName}>
                <td className="px-4 py-2 font-medium">{data.partners[h.partnerId].shortName}</td>
                <td className="tabular text-caption">{h.records.map((r) => r.shipmentId).join(', ')}</td>
                <td className="tabular text-right">{formatINR(h.amount)}</td>
                <td className={cn('tabular text-right', h.late && 'font-semibold text-status-danger')}>{t('erp34.hours', { count: h.hours })}</td>
                <td className="py-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => setShortFor(h.records)}>
                    {t('erp34.raiseShortage')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={t('erp34.deposited')} empty={deposited.length === 0} emptyText={t('erp34.depositedEmpty')}>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="deposited">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp34.col.customer')}</th>
              <th className="text-right">{t('erp34.col.shipments')}</th>
              <th className="text-right">{t('erp34.col.amount')}</th>
              <th>{t('erp34.col.remitBy')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deposited.map((d) => (
              <tr key={d.customerId} className="border-b last:border-0" aria-label={data.customers[d.customerId].shortName}>
                <td className="px-4 py-2 font-medium">{data.customers[d.customerId].shortName}</td>
                <td className="tabular text-right">{d.records.length}</td>
                <td className="tabular text-right">{formatINR(d.amount)}</td>
                <td className="tabular">{formatDate(d.remitBy)}</td>
                <td className="py-2 text-right">
                  <Button size="sm" onClick={() => createBatch(d.customerId)}>
                    {t('erp34.createBatch')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={t('erp34.batches')} empty={batches.length === 0} emptyText={t('erp34.batchesEmpty')}>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="batches">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp34.col.batch')}</th>
              <th>{t('erp34.col.date')}</th>
              <th>{t('erp34.col.customer')}</th>
              <th className="text-right">{t('erp34.col.amount')}</th>
              <th>{t('erp34.col.utr')}</th>
              <th>{t('erp34.col.makerChecker')}</th>
              <th>{t('erp34.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const waiting = b.status === 'pendingApproval' || b.status === 'onHold'
              return (
                <tr key={b.id} className="border-b last:border-0" aria-label={b.id}>
                  <td className="tabular px-4 py-2 font-medium">{b.id}</td>
                  <td className="tabular">{formatDate(b.date)}</td>
                  <td>{data.customers[b.customerId].shortName}</td>
                  <td className="tabular text-right">{formatINR(b.net)}</td>
                  <td className="tabular">{b.utr ?? '—'}</td>
                  <td className="text-caption">
                    {name(b.makerId)} / {name(b.checkerId)}
                  </td>
                  <td className="py-2">
                    {waiting && isChecker && b.makerId !== user.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setApprove(b)}>
                          {t('erp34.approve')}
                        </Button>
                        {b.status === 'pendingApproval' && (
                          <Button size="sm" variant="outline" onClick={() => useDemoStore.getState().decideRemittanceBatch(b.id, 'hold', user.id)}>
                            {t('erp34.hold')}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="flex flex-col gap-0.5">
                        <Chip tone={REMITTANCE_TONE[b.status]}>{t(`erp34.status.${b.status}`)}</Chip>
                        {waiting && <span className="text-caption text-muted-foreground">{t('erp34.waitingChecker')}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title={t('erp34.shortages')} empty={short.length === 0} emptyText={t('erp34.shortagesEmpty')}>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="shortages">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp34.col.partner')}</th>
              <th>{t('erp34.col.lr')}</th>
              <th className="text-right">{t('erp34.col.amount')}</th>
              <th>{t('erp34.col.evidence')}</th>
              <th>{t('erp34.col.deduction')}</th>
            </tr>
          </thead>
          <tbody>
            {short.map((r) => (
              <tr key={r.id} className="border-b last:border-0" aria-label={r.shipmentId}>
                <td className="px-4 py-2 font-medium">{r.partnerId ? data.partners[r.partnerId].shortName : '—'}</td>
                <td className="tabular">{r.shipmentId}</td>
                <td className="tabular text-right">{formatINR(r.shortage!.amount)}</td>
                <td>{r.shortage!.evidence}</td>
                <td>
                  <Chip tone={r.shortage!.status === 'deducted' ? 'success' : 'warning'}>{t(`erp34.deduction.${r.shortage!.status}`)}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {shortFor && <ShortageDialog records={shortFor} onClose={() => setShortFor(undefined)} />}
      <ConfirmDialog
        open={!!approve}
        onOpenChange={(o) => !o && setApprove(undefined)}
        title={t('erp34.confirmApprove', { amount: approve ? formatINR(approve.net) : '' })}
        body={approve ? t('erp34.confirmBody', { customer: data.customers[approve.customerId].shortName, count: approve.recordIds.length, maker: name(approve.makerId) }) : ''}
        confirmLabel={t('erp34.approve')}
        onConfirm={() => {
          if (!approve) return
          useDemoStore.getState().decideRemittanceBatch(approve.id, 'approve', user.id)
          toast.success(t('erp34.remitted', { id: approve.id }))
        }}
      />
    </div>
  )
}

function Panel({ title, empty, emptyText, children }: { title: string; empty: boolean; emptyText: string; children: React.ReactNode }) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={title}>
      <h2 className="px-4 pt-4 font-heading text-section font-semibold">{title}</h2>
      {empty ? <p className="p-4 text-muted-foreground">{emptyText}</p> : <div className="mt-2">{children}</div>}
    </section>
  )
}

function ShortageDialog({ records, onClose }: { records: CodRecord[]; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const [id, setId] = useState(records[0].id)
  const rec = records.find((r) => r.id === id)!
  const [amount, setAmount] = useState(String(rec.amount))
  const [evidence, setEvidence] = useState('')
  const amt = Number(amount)
  const ok = amt > 0 && amt <= rec.amount && !!evidence.trim()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('erp34.raiseShortage')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t('erp34.col.lr')} htmlFor="sh-lr">
            <NativeSelect
              id="sh-lr"
              value={id}
              onChange={(e) => {
                setId(e.target.value)
                setAmount(String(records.find((r) => r.id === e.target.value)!.amount))
              }}
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.shipmentId} · {formatINR(r.amount)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('erp34.shortAmount')} htmlFor="sh-amt" required error={amt > rec.amount ? t('erp34.atMost', { amount: formatINR(rec.amount) }) : undefined}>
            <Input id="sh-amt" type="number" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t('erp34.col.evidence')} htmlFor="sh-ev" required hint={t('erp34.evidenceHint')}>
            <Input id="sh-ev" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </Field>
          <p className="text-caption text-muted-foreground">{t('erp34.shortRule')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              useDemoStore.getState().raiseCodShortage(rec.id, amt, evidence, user.id)
              toast.success(t('erp34.shortRaised', { lr: rec.shipmentId }))
              onClose()
            }}
          >
            {t('erp34.raiseShortage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
