/**
 * CP-22 Claims (list, raise, detail) — docs/01-customer-portal.md §6.5.
 * Source §10 Step 4: claim opened with chain-of-custody evidence (hand-over
 * scans, photos, seal numbers); Logisco settles within 7 days. Liability between
 * partners is internal: no partner names are shown here.
 */
import { CheckCircle2, Paperclip, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { CLAIM_DESCRIPTION_MAX, CLAIM_TYPES, claimableShipments, claimCap, custodyChain } from '@shared/engines/claims'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { canReopen } from '@shared/store/claimActions'
import type { Claim, ClaimType } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useCustomerSession } from './useCustomerSession'

export const CLAIM_TONE: Record<Claim['status'], Tone> = { raised: 'info', investigating: 'warning', approved: 'success', partlyApproved: 'warning', rejected: 'danger', settled: 'success', closed: 'neutral' }

/** Status as the customer sees it: a settled claim for less than claimed reads "Partly approved · settled". */
function useStatusLabel() {
  const { t } = useTranslation()
  return (c: Claim) => (c.status === 'settled' && (c.amountApproved ?? 0) < c.amountClaimed ? `${t('claims.status.partlyApproved')} · ${t('claims.status.settled')}` : t(`claims.status.${c.status}`))
}

export default function CP22Claims() {
  const { t } = useTranslation()
  const { customer, user } = useCustomerSession()
  const data = useData((d) => d)
  const statusLabel = useStatusLabel()
  const claims = Object.values(data.claims)
    .filter((c) => c.customerId === customer.id)
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp22.title')}
        subtitle={t('cp22.subtitle')}
        actions={
          user.role !== 'finance' && (
            <Button asChild>
              <Link to="/customer/claims/new">
                <Plus /> {t('cp22.raise')}
              </Link>
            </Button>
          )
        }
        className="mb-0"
      />
      {claims.length === 0 ? (
        <EmptyState title={t('cp22.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="claims">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp22.col.claim')}</th>
                <th>{t('cp22.col.lr')}</th>
                <th>{t('cp22.col.type')}</th>
                <th className="text-right">{t('cp22.col.amount')}</th>
                <th>{t('cp22.col.status')}</th>
                <th>{t('cp22.col.dates')}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b last:border-0" aria-label={c.id}>
                  <td className="px-4 py-2">
                    <Link to={`/customer/claims/${c.id}`} className="tabular font-medium text-primary hover:underline">
                      {c.id}
                    </Link>
                  </td>
                  <td className="tabular">{c.shipmentId}</td>
                  <td>{t(`claims.type.${c.type}`)}</td>
                  <td className="tabular text-right">
                    {formatINR(c.amountClaimed)} / {c.amountApproved !== undefined ? formatINR(c.amountApproved) : '—'}
                  </td>
                  <td>
                    <Chip tone={CLAIM_TONE[c.status]}>{statusLabel(c)}</Chip>
                  </td>
                  <td className="tabular">
                    {formatDate(c.raisedAt)}
                    {c.settlement ? ` / ${formatDate(c.settlement.at)}` : ''}
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

/** CP-22 Raise claim. */
export function CP22RaiseClaim() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { customer, user } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const eligible = claimableShipments(data, customer.id, now)
  const [lr, setLr] = useState(eligible.some((s) => s.id === params.get('lr')) ? params.get('lr')! : '')
  const s = data.shipments[lr]
  const [type, setType] = useState<ClaimType | ''>(params.get('type') === 'damage' ? 'damage' : s?.status === 'deliveredWithException' ? 'shortage' : '')
  const [pieces, setPieces] = useState<string[]>(() => (s ? s.pieces.filter((p) => p.condition === 'missing' || p.condition === 'damaged').map((p) => p.id) : []))
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const cap = s && pieces.length ? claimCap(data, s, pieces) : undefined
  const amt = Number(amount)
  const req = t('cp04.err.required')
  const errors = {
    lr: !s ? req : undefined,
    type: !type ? req : undefined,
    pieces: !pieces.length ? req : undefined,
    amount: !(amt > 0) ? req : cap && amt > cap.max ? t('cp22.err.amount', { max: formatINR(cap.max) }) : undefined,
    description: !description.trim() ? req : undefined,
    files: !files.length ? t('cp22.err.files') : undefined,
  }
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined)
  const bank = customer.bank

  if (user.role === 'finance') return <NotFound />
  const submit = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return toast.error(t('cp04.fix'))
    const id = useDemoStore.getState().raiseClaim({ lr, type: type as ClaimType, pieceIds: pieces, amount: amt, description, files }, user.id)
    if (!id) return toast.error(t('cp22.failed'))
    toast.success(t('cp22.submitted', { id }))
    navigate(`/customer/claims/${id}`)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('cp22.raiseTitle')} subtitle={t('cp22.window', { days: data.settings.claimWindowDays })} className="mb-0" />
      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <Field label={t('cp22.lr')} htmlFor="cl-lr" required error={err('lr')} hint={eligible.length ? undefined : t('cp22.noneEligible')}>
          <Input
            id="cl-lr"
            list="cl-lrs"
            className="tabular"
            value={lr}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().trim()
              setLr(v)
              const n = data.shipments[v]
              setPieces(n ? n.pieces.filter((p) => p.condition === 'missing' || p.condition === 'damaged').map((p) => p.id) : [])
            }}
          />
          <datalist id="cl-lrs">
            {eligible.map((x) => (
              <option key={x.id} value={x.id} />
            ))}
          </datalist>
        </Field>
        <Field label={t('cp22.type')} htmlFor="cl-type" required error={err('type')}>
          <NativeSelect id="cl-type" value={type} onChange={(e) => setType(e.target.value as ClaimType)}>
            <option value="">{t('cp04.choose')}</option>
            {CLAIM_TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`claims.type.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {s && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 font-medium">
              {t('cp22.pieces')} <span className="text-status-danger">*</span>
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('cp22.pieces')}>
              {s.pieces.map((p, i) => (
                <label key={p.id} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption', pieces.includes(p.id) && 'border-primary bg-primary-soft')}>
                  <Checkbox checked={pieces.includes(p.id)} onCheckedChange={(v) => setPieces(v === true ? [...pieces, p.id] : pieces.filter((x) => x !== p.id))} />
                  {t('cp22.piece', { n: i + 1, total: s.pieces.length })}
                  {p.condition && p.condition !== 'ok' && <span className="text-status-danger">· {t(`cp22.cond.${p.condition}`)}</span>}
                </label>
              ))}
            </div>
            {err('pieces') && <p className="mt-1 text-caption font-medium text-status-danger">{err('pieces')}</p>}
          </fieldset>
        )}
        <Field
          label={t('cp22.amount')}
          htmlFor="cl-amt"
          required
          error={err('amount')}
          hint={cap ? (s!.addOns.insurance ? t('cp22.capInsured', { share: formatINR(cap.invoiceShare) }) : t('cp22.cap', { share: formatINR(cap.invoiceShare), liability: formatINR(cap.liabilityCap!) })) : undefined}
        >
          <Input id="cl-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('cp22.settlement')} htmlFor="cl-acc">
          <Input id="cl-acc" readOnly className="bg-gray-50" value={customer.billing === 'credit' ? t('cp22.creditNote') : bank ? `${bank.name} ••${bank.account.slice(-4)}` : t('cp22.creditNote')} />
        </Field>
        <Field label={t('cp22.description')} htmlFor="cl-desc" required error={err('description')} hint={t('cp20.remarksCount', { n: description.length, max: CLAIM_DESCRIPTION_MAX })} className="sm:col-span-2">
          <textarea id="cl-desc" rows={3} maxLength={CLAIM_DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-body" />
        </Field>
        <Field label={t('cp22.evidence')} htmlFor="cl-files" required error={err('files')} hint={t('cp22.evidenceHint')} className="sm:col-span-2">
          <input id="cl-files" type="file" multiple className="text-caption file:mr-2 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
        </Field>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 sm:col-span-2">
            {files.map((f) => (
              <li key={f} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-caption">
                <Paperclip className="size-3" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        )}
        <Button className="self-start" onClick={submit}>
          {t('cp22.submit')}
        </Button>
      </section>
    </div>
  )
}

/** CP-22 Claim detail: evidence timeline (no partner names), decision, settlement; add info, confirm, reopen. */
export function CP22ClaimDetail() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { customer, user } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const statusLabel = useStatusLabel()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [reopen, setReopen] = useState('')
  const c = data.claims[id]
  if (!c || c.customerId !== customer.id) return <NotFound />
  const s = data.shipments[c.shipmentId]
  const chain = custodyChain(data, s)
  const acts = user.role !== 'finance'
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link to="/customer/claims" className="text-caption font-medium text-muted-foreground hover:text-foreground">
        ← {t('cp22.title')}
      </Link>
      <PageHeader
        title={c.id}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/customer/shipments/${s.id}`} className="tabular text-primary hover:underline">
              {s.id}
            </Link>
            · {t(`claims.type.${c.type}`)} · {formatINR(c.amountClaimed)}
            <Chip tone={CLAIM_TONE[c.status]} bold>
              {statusLabel(c)}
            </Chip>
          </span>
        }
        className="mb-0"
      />
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ev-h">
        <h2 id="ev-h" className="mb-2 font-semibold">
          {t('cp22.evidenceTimeline')}
        </h2>
        <ol className="flex flex-col gap-2" data-testid="custody">
          {chain.map((x) => (
            <li key={x.leg.id} className="flex flex-wrap items-baseline gap-x-3 border-l-2 pl-3">
              <span className="font-medium">
                L{x.leg.seq} {t(`legType.${x.leg.type}`)}
              </span>
              <span className={cn('tabular text-table', x.piecesIn.length !== x.piecesOut.length && 'font-semibold text-status-danger')}>{t('claims.inOut', { in: x.piecesIn.length, out: x.piecesOut.length })}</span>
              {(x.sealsIn.length > 0 || x.sealsOut.length > 0) && <span className="text-caption text-muted-foreground">{t('claims.seals', { seals: [...new Set([...x.sealsIn, ...x.sealsOut])].join(', ') })}</span>}
              {x.photos > 0 && <span className="text-caption text-muted-foreground">{t('claims.photos', { count: x.photos })}</span>}
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dec-h" data-testid="decision">
        <h2 id="dec-h" className="font-semibold">
          {t('cp22.decision')}
        </h2>
        {c.decision ? (
          <>
            <p>
              <span className="font-semibold">{c.decision.amount ? formatINR(c.decision.amount) : t('claims.status.rejected')}</span> · {c.decision.reason}
            </p>
            {c.settlement && <p className="text-muted-foreground">{t(`cp22.settled.${c.settlement.method}`, { ref: c.settlement.ref, date: formatDate(c.settlement.at) })}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">{t('cp22.pending', { date: formatDate(c.settleBy) })}</p>
        )}
        {c.confirmedAt && (
          <p className="flex items-center gap-2 text-status-success">
            <CheckCircle2 className="size-4" aria-hidden /> {t('cp22.confirmedOn', { at: formatDateTime(c.confirmedAt) })}
          </p>
        )}
      </section>
      {(c.info?.length ?? 0) > 0 && (
        <ol className="flex flex-col gap-1 rounded-xl border bg-card p-5 text-table shadow-card" aria-label={t('cp22.info')}>
          {c.info!.map((i, k) => (
            <li key={k}>
              <span className="tabular text-caption text-muted-foreground">{formatDateTime(i.at)}</span> · {i.text} {i.files.length > 0 && <span className="text-caption text-muted-foreground">({i.files.join(', ')})</span>}
            </li>
          ))}
        </ol>
      )}
      {acts && c.status !== 'closed' && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
          {(c.status === 'settled' || c.status === 'rejected') && (
            <Button className="self-start" onClick={() => (useDemoStore.getState().confirmClaim(c.id, user.id), toast.success(t('cp22.confirmed')))}>
              <CheckCircle2 /> {t('cp22.confirm')}
            </Button>
          )}
          {(c.status === 'raised' || c.status === 'investigating') && (
            <div className="flex flex-col gap-2">
              <Field label={t('cp22.addInfo')} htmlFor="cl-info" small>
                <Input id="cl-info" value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <input aria-label={t('cp22.addFiles')} type="file" multiple className="text-caption" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
              <Button size="sm" variant="outline" className="self-start" disabled={!text.trim() && !files.length} onClick={() => (useDemoStore.getState().addClaimInfo(c.id, text, files, user.id), setText(''), setFiles([]), toast.success(t('cp22.infoSent')))}>
                {t('cp22.send')}
              </Button>
            </div>
          )}
        </section>
      )}
      {acts && canReopen(c, now) && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
          <Field label={t('cp22.reopenReason')} htmlFor="cl-reopen" small hint={t('cp22.reopenHint')}>
            <Input id="cl-reopen" value={reopen} onChange={(e) => setReopen(e.target.value)} />
          </Field>
          <Button size="sm" variant="outline" className="self-start" disabled={!reopen.trim()} onClick={() => (useDemoStore.getState().reopenClaim(c.id, reopen, user.id), setReopen(''), toast.success(t('cp22.reopened')))}>
            {t('cp22.reopen')}
          </Button>
        </section>
      )}
    </div>
  )
}
