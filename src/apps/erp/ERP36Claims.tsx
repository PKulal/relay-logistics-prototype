/**
 * ERP-36 Claims desk and ERP-37 Claim investigation and liability —
 * docs/04-erp-control-tower.md. Source §10 Step 4: chain-of-custody evidence,
 * the liability engine finds the leg and partner at the fault point, Logisco
 * settles the customer within 7 days and recovers from the partner payout or
 * insurer; §12: AI never closes a claim, a person approves. Approval by the
 * Claims Officer (no separate Claims Head persona in the seed; maker-checker
 * pending, see the build plan).
 */
import { Bot } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { claimCap, custodyChain, fraudSignals, liableLeg, partnerCap, suggestedRecovery } from '@shared/engines/claims'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { ist } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { Claim } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useErpSession } from './useErpSession'

const TONE: Record<Claim['status'], Tone> = { raised: 'info', investigating: 'warning', approved: 'success', partlyApproved: 'warning', rejected: 'danger', settled: 'success', closed: 'neutral' }

export default function ERP36ClaimsDesk() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const claims = Object.values(data.claims).sort((a, b) => Number(['settled', 'rejected', 'closed'].includes(a.status)) - Number(['settled', 'rejected', 'closed'].includes(b.status)) || a.settleBy.localeCompare(b.settleBy))
  const open = claims.filter((c) => c.status === 'raised' || c.status === 'investigating').length
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp36.title')} subtitle={t('erp36.subtitle', { count: open, days: data.settings.claimSettlementDays })} className="mb-0" />
      {claims.length === 0 ? (
        <EmptyState title={t('erp36.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="claims-desk">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp36.col.claim')}</th>
                <th className="text-right">{t('erp36.col.amount')}</th>
                <th>{t('erp36.col.settleBy')}</th>
                <th>{t('erp36.col.liable')}</th>
                <th>{t('erp36.col.fraud')}</th>
                <th>{t('erp36.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const leg = c.liableLegId ? data.legs[c.liableLegId] : undefined
                const flags = fraudSignals(data, c)
                const live = c.status === 'raised' || c.status === 'investigating'
                return (
                  <tr key={c.id} className="border-b align-top last:border-0" aria-label={c.id}>
                    <td className="px-4 py-2">
                      <Link to={`/erp/claims/${c.id}`} className="tabular font-medium text-primary hover:underline">
                        {c.id}
                      </Link>
                      <span className="block text-caption text-muted-foreground">
                        {c.shipmentId} · {data.customers[c.customerId].shortName} · {t(`claims.type.${c.type}`)}
                      </span>
                    </td>
                    <td className="tabular py-2 text-right">{formatINR(c.amountClaimed)}</td>
                    <td className="py-2">{live ? <SlaTimer dueAt={ist(c.settleBy, '23:59')} totalMinutes={data.settings.claimSettlementDays * 24 * 60} /> : formatDate(c.settleBy)}</td>
                    <td className="py-2">{leg ? `L${leg.seq} · ${data.partners[leg.partnerId].shortName}` : '—'}</td>
                    <td className="py-2">{flags.length ? <Chip tone="danger">{flags.map((f) => t(`erp36.fraud.${f}`)).join(', ')}</Chip> : <Chip tone="neutral">{t('erp36.none')}</Chip>}</td>
                    <td className="py-2">
                      <Chip tone={TONE[c.status]}>{t(`claims.status.${c.status}`)}</Chip>
                      {c.partner?.status === 'contested' && <span className="block text-caption font-medium text-status-warning">{t('erp37.contested')}</span>}
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

/** ERP-37 Claim investigation and liability. */
export function ERP37Claim() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const data = useData((d) => d)
  const c = data.claims[id]
  if (!c) return <NotFound />
  const s = data.shipments[c.shipmentId]
  const chain = custodyChain(data, s)
  const liability = liableLeg(data, s, c.type, c.pieceIds)
  const flags = fraudSignals(data, c)
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Link to="/erp/claims/desk" className="text-caption font-medium text-muted-foreground hover:text-foreground">
        ← {t('erp36.title')}
      </Link>
      <PageHeader
        title={`${c.id} · ${t(`claims.type.${c.type}`)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/erp/shipments/${s.id}`} className="tabular text-primary hover:underline">
              {s.id}
            </Link>
            · {data.customers[c.customerId].legalName} · {formatINR(c.amountClaimed)}
            <Chip tone={TONE[c.status]} bold>
              {t(`claims.status.${c.status}`)}
            </Chip>
          </span>
        }
        className="mb-0"
      />
      <section className="rounded-xl border bg-card p-5 text-table shadow-card" aria-label={t('erp37.customerSays')}>
        <p className="font-medium">{t('erp37.customerSays')}</p>
        <p>{c.description}</p>
        <p className="text-caption text-muted-foreground">
          {t('erp37.pieces', { pieces: c.pieceIds.map((p) => p.slice(-2)).join(', ') })} · {c.files?.join(', ')}
        </p>
        {c.info?.map((i, k) => (
          <p key={k} className="text-caption">
            {formatDateTime(i.at)} · {i.text} {i.files.join(', ')}
          </p>
        ))}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="chain-h">
        <h2 id="chain-h" className="mb-2 font-semibold">
          {t('erp37.evidence')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="custody">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp37.col.leg')}</th>
                <th>{t('erp37.col.partner')}</th>
                <th className="text-right">{t('erp37.col.in')}</th>
                <th className="text-right">{t('erp37.col.out')}</th>
                <th>{t('erp37.col.seals')}</th>
                <th className="text-right">{t('erp37.col.photos')}</th>
                <th>{t('erp37.col.staff')}</th>
              </tr>
            </thead>
            <tbody>
              {chain.map((x) => (
                <tr key={x.leg.id} className={cn('border-b last:border-0', liability?.legId === x.leg.id && 'bg-status-danger-bg')} aria-label={`L${x.leg.seq}`}>
                  <td className="py-2">
                    L{x.leg.seq} {t(`legType.${x.leg.type}`)}
                  </td>
                  <td>{data.partners[x.leg.partnerId].shortName}</td>
                  <td className="tabular text-right">{x.piecesIn.length}</td>
                  <td className={cn('tabular text-right', x.piecesIn.length !== x.piecesOut.length && 'font-semibold text-status-danger')}>{x.piecesOut.length}</td>
                  <td className="tabular">{[...x.sealsIn.map((v) => `↓${v}`), ...x.sealsOut.map((v) => `↑${v}`)].join(' ') || '—'}</td>
                  <td className="tabular text-right">{x.photos}</td>
                  <td>{x.staffIds.map((sid) => data.fieldStaff[sid]?.name ?? sid).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 p-3" data-testid="liability">
          <Bot className="mt-0.5 size-4 shrink-0" aria-hidden />
          {liability ? (
            <span>
              <span className="font-semibold">
                {t('erp37.liable', { seq: data.legs[liability.legId].seq, partner: data.partners[liability.partnerId].shortName })}
              </span>{' '}
              · {t(`claims.why.${liability.why}`, { in: liability.in, out: liability.out })}
            </span>
          ) : (
            t('erp37.noLiability')
          )}
          <SimulatedTag />
        </p>
        <p className="mt-2 text-caption">
          {t('erp37.fraud')}: {flags.length ? flags.map((f) => t(`erp36.fraud.${f}`)).join(', ') : t('erp36.none')}
        </p>
      </section>

      {c.status === 'raised' || c.status === 'investigating' ? <Decide claim={c} /> : <Outcome claim={c} />}
      {c.partner && <PartnerSide claim={c} />}
    </div>
  )
}

function Decide({ claim: c }: { claim: Claim }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const s = data.shipments[c.shipmentId]
  const cap = claimCap(data, s, c.pieceIds)
  const pCap = c.liablePartnerId ? partnerCap(data, c.liablePartnerId, s) : 0
  const [amount, setAmount] = useState(String(Math.min(c.amountClaimed, cap.max)))
  const amt = Number(amount)
  const suggested = useMemo(() => suggestedRecovery(data, s, c.liablePartnerId, amt > 0 ? amt : 0), [data, s, c.liablePartnerId, amt])
  const [split, setSplit] = useState<{ partner: string; partnerInsurer: string; insurer: string } | null>(null)
  const r = split ?? { partner: String(suggested.partner), partnerInsurer: String(suggested.partnerInsurer ?? 0), insurer: String(suggested.insurer) }
  const [method, setMethod] = useState<'creditNote' | 'bank'>('creditNote')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(false)
  const canAct = user.role === 'claims'
  const recovery = { partner: Number(r.partner) || 0, partnerInsurer: Number(r.partnerInsurer) || 0, insurer: Number(r.insurer) || 0 }
  const sum = Math.round((recovery.partner + recovery.partnerInsurer + recovery.insurer) * 100) / 100
  const valid = reason.trim() && amt >= 0 && amt <= cap.max && (amt === 0 || (sum === amt && recovery.partner <= pCap))

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dec-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dec-h" className="font-semibold">
          {t('erp37.decision')}
        </h2>
        {c.status === 'raised' && canAct && (
          <Button size="sm" variant="outline" onClick={() => useDemoStore.getState().startInvestigation(c.id, user.id)}>
            {t('erp37.investigate')}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('erp37.approved')} htmlFor="e37-amt" required hint={s.addOns.insurance ? t('cp22.capInsured', { share: formatINR(cap.invoiceShare) }) : t('cp22.cap', { share: formatINR(cap.invoiceShare), liability: formatINR(cap.liabilityCap!) })}>
          <Input id="e37-amt" type="number" min={0} value={amount} onChange={(e) => (setAmount(e.target.value), setSplit(null))} />
        </Field>
        <Field label={t('erp37.reason')} htmlFor="e37-reason" required hint={t('erp37.reasonHint')}>
          <Input id="e37-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      {amt > 0 && (
        <>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="flex gap-4" aria-label={t('erp37.settleBy')}>
            {(['creditNote', 'bank'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} /> {t(`erp37.method.${m}`)}
              </label>
            ))}
          </RadioGroup>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 font-medium">{t('erp37.recover')}</legend>
            <Field label={t('erp37.fromPartner', { cap: formatINR(pCap) })} htmlFor="e37-p" small error={recovery.partner > pCap ? t('erp37.overCap') : undefined}>
              <Input id="e37-p" type="number" min={0} value={r.partner} onChange={(e) => setSplit({ ...r, partner: e.target.value })} />
            </Field>
            <Field label={t('erp37.fromPartnerInsurer')} htmlFor="e37-pi" small>
              <Input id="e37-pi" type="number" min={0} value={r.partnerInsurer} onChange={(e) => setSplit({ ...r, partnerInsurer: e.target.value })} />
            </Field>
            <Field label={t('erp37.fromInsurer')} htmlFor="e37-i" small>
              <Input id="e37-i" type="number" min={0} value={r.insurer} onChange={(e) => setSplit({ ...r, insurer: e.target.value })} />
            </Field>
            {sum !== amt && <p className="text-caption font-medium text-status-danger sm:col-span-3">{t('erp37.splitMismatch', { sum: formatINR(sum), amount: formatINR(amt) })}</p>}
          </fieldset>
        </>
      )}
      <Button className="self-start" disabled={!canAct || !valid} onClick={() => setConfirm(true)}>
        {amt === 0 ? t('erp37.reject') : t('erp37.approve')}
      </Button>
      {!canAct && <p className="text-caption text-muted-foreground">{t('erp37.claimsOnly')}</p>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={amt === 0 ? t('erp37.confirmReject') : t('erp37.confirmApprove', { amount: formatINR(amt) })}
        body={amt === 0 ? reason : t('erp37.confirmBody', { method: t(`erp37.method.${method}`), partner: formatINR(recovery.partner) })}
        confirmLabel={amt === 0 ? t('erp37.reject') : t('erp37.approve')}
        destructive={amt === 0}
        onConfirm={() => {
          useDemoStore.getState().settleClaim(c.id, { amount: amt, reason, method, recovery }, user.id)
          toast.success(amt === 0 ? t('erp37.rejected') : t('erp37.settled'))
        }}
      />
    </section>
  )
}

function Outcome({ claim: c }: { claim: Claim }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="out-h" data-testid="outcome">
      <h2 id="out-h" className="font-semibold">
        {t('erp37.decision')}
      </h2>
      {c.decision && (
        <p>
          <span className="font-semibold">{c.decision.amount ? formatINR(c.decision.amount) : t('claims.status.rejected')}</span> · {c.decision.reason}
          <span className="block text-caption text-muted-foreground">{t('erp37.by', { name: data.staff[c.decision.by]?.name ?? c.decision.by, at: formatDateTime(c.decision.at) })}</span>
        </p>
      )}
      {c.settlement && <p>{t(`cp22.settled.${c.settlement.method}`, { ref: c.settlement.ref, date: formatDate(c.settlement.at) })}</p>}
      {c.decision?.amount ? (
        <p className="text-table">
          {t('erp37.recovery', { partner: formatINR(c.recovery.partner), partnerInsurer: formatINR(c.recovery.partnerInsurer ?? 0), insurer: formatINR(c.recovery.insurer) })}
          {c.recovery.insurerRef && ` · ${c.recovery.insurerRef}`}
        </p>
      ) : null}
      <p className="text-caption">{c.confirmedAt ? t('erp37.customerConfirmed', { at: formatDateTime(c.confirmedAt) }) : c.confirmationRequestedAt ? t('erp37.confirmationRequested', { at: formatDateTime(c.confirmationRequestedAt) }) : ''}</p>
      {(c.status === 'settled' || c.status === 'rejected') && !c.confirmedAt && user.role === 'claims' && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => (useDemoStore.getState().requestClaimConfirmation(c.id, user.id), toast.success(t('erp37.requested')))}>
          {t('erp37.requestConfirmation')}
        </Button>
      )}
    </section>
  )
}

function PartnerSide({ claim: c }: { claim: Claim }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [note, setNote] = useState('')
  const p = c.partner!
  const canAct = user.role === 'claims'
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ps-h" data-testid="partner-side">
      <h2 id="ps-h" className="font-semibold">
        {t('erp37.partnerSide', { partner: data.partners[c.liablePartnerId!].shortName })}
      </h2>
      <p>
        <Chip tone={p.status === 'contested' ? 'warning' : 'info'}>{t(`claims.partnerStatus.${p.status}`)}</Chip> {formatINR(c.recovery.partner)}
        {p.payoutDate && p.status !== 'recoveredFromInsurer' && ` · ${t('pp22.payout', { date: formatDate(p.payoutDate) })}`}
      </p>
      {p.reason && <p className="text-table">“{p.reason}” {p.files?.join(', ')}</p>}
      {p.insurer && <p className="text-table">{t('erp37.partnerInsurer', { insurer: p.insurer, policy: p.policy })}</p>}
      {canAct && (p.status === 'contested' || p.status === 'insuranceClaim') && (
        <div className="flex flex-col gap-2">
          <Input aria-label={t('erp37.contestNote')} placeholder={t('erp37.contestNote')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {p.status === 'contested' ? (
              <>
                <Button size="sm" onClick={() => (useDemoStore.getState().decidePartnerClaim(c.id, 'upheld', note, user.id), toast.success(t('erp37.upheld')))}>
                  {t('erp37.uphold')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => (useDemoStore.getState().decidePartnerClaim(c.id, 'waived', note, user.id), toast.success(t('erp37.waived')))}>
                  {t('erp37.waive')}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => (useDemoStore.getState().decidePartnerClaim(c.id, 'recoveredFromInsurer', note, user.id), toast.success(t('erp37.recovered')))}>
                {t('erp37.markRecovered')}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
