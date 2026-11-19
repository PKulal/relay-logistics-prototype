/**
 * PP-22 Claims and deductions — docs/02-partner-portal.md §6.5.
 * Source §10 Step 4 (liability engine attributes the claim to the leg); §5.1 and
 * §9 (every deduction shown with its evidence). The partner accepts, contests
 * or claims on its own insurance.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { custodyChain } from '@shared/engines/claims'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Claim } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

export default function PP22Claims() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const claims = Object.values(data.claims)
    .filter((c) => c.liablePartnerId === partner.id && c.partner)
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp22.title')} subtitle={t('pp22.subtitle')} className="mb-0" />
      {claims.length === 0 ? (
        <EmptyState title={t('pp22.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-claims">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp22.col.claim')}</th>
                <th>{t('pp22.col.leg')}</th>
                <th>{t('pp22.col.type')}</th>
                <th className="text-right">{t('pp22.col.amount')}</th>
                <th>{t('pp22.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const leg = data.legs[c.liableLegId!]
                return (
                  <tr key={c.id} className="border-b last:border-0" aria-label={c.id}>
                    <td className="px-4 py-2">
                      <Link to={`/partner/claims/${c.id}`} className="tabular font-medium text-primary hover:underline">
                        {c.id}
                      </Link>
                    </td>
                    <td>
                      <span className="tabular">{c.shipmentId}</span> · {t('pp22.legN', { n: leg.seq, type: t(`legType.${leg.type}`) })}
                    </td>
                    <td>{t(`claims.type.${c.type}`)}</td>
                    <td className="tabular text-right">{formatINR(c.recovery.partner)}</td>
                    <td>
                      <Chip tone={c.partner!.status === 'notified' ? 'warning' : c.partner!.status === 'contested' ? 'info' : 'neutral'}>{t(`claims.partnerStatus.${c.partner!.status}`)}</Chip>
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

export function PP22ClaimDetail() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const c = data.claims[id]
  if (!c || c.liablePartnerId !== partner.id || !c.partner) return <NotFound />
  const s = data.shipments[c.shipmentId]
  const chain = custodyChain(data, s)
  const mine = chain.findIndex((x) => x.leg.id === c.liableLegId)
  // Before, during and after your leg (partner names of other legs are not shown)
  const around = chain.slice(Math.max(0, mine - 1), mine + 2)
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link to="/partner/claims" className="text-caption font-medium text-muted-foreground hover:text-foreground">
        ← {t('pp22.title')}
      </Link>
      <PageHeader
        title={`${c.id} · ${t(`claims.type.${c.type}`)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{s.id}</span> · {formatINR(c.recovery.partner)}
            <Chip tone="info" bold>
              {t(`claims.partnerStatus.${c.partner.status}`)}
            </Chip>
          </span>
        }
        className="mb-0"
      />
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ev-h">
        <h2 id="ev-h" className="mb-2 font-semibold">
          {t('pp22.evidence')}
        </h2>
        <ol className="flex flex-col gap-2" data-testid="evidence">
          {around.map((x) => (
            <li key={x.leg.id} className={cn('flex flex-wrap items-baseline gap-x-3 border-l-2 pl-3', x.leg.id === c.liableLegId && 'border-status-danger')}>
              <span className="font-medium">
                L{x.leg.seq} {t(`legType.${x.leg.type}`)} {x.leg.id === c.liableLegId && `(${t('pp22.yourLeg')})`}
              </span>
              <span className={cn('tabular text-table', x.piecesIn.length !== x.piecesOut.length && 'font-semibold text-status-danger')}>{t('claims.inOut', { in: x.piecesIn.length, out: x.piecesOut.length })}</span>
              {(x.sealsIn.length > 0 || x.sealsOut.length > 0) && <span className="text-caption text-muted-foreground">{t('claims.seals', { seals: [...new Set([...x.sealsIn, ...x.sealsOut])].join(', ') })}</span>}
              {x.photos > 0 && <span className="text-caption text-muted-foreground">{t('claims.photos', { count: x.photos })}</span>}
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dd-h" data-testid="deduction">
        <h2 id="dd-h" className="font-semibold">
          {t('pp22.decision')}
        </h2>
        <p>{c.partner.decision === 'waived' ? t('pp22.waived') : t('pp22.amount', { amount: formatINR(c.recovery.partner) })}</p>
        {c.partner.payoutDate && c.partner.decision !== 'waived' && !['insuranceClaim', 'recoveredFromInsurer'].includes(c.partner.status) && (
          <p className="text-muted-foreground">{c.partner.status === 'deducted' ? t('pp22.deducted', { date: formatDate(c.partner.payoutDate) }) : t('pp22.payout', { date: formatDate(c.partner.payoutDate) })}</p>
        )}
        {c.partner.status === 'insuranceClaim' && <p className="text-muted-foreground">{t('pp22.held')}</p>}
      </section>
      {c.partner.status === 'notified' && (user.role === 'admin' || user.role === 'finance') && <Respond claim={c} />}
    </div>
  )
}

function Respond({ claim: c }: { claim: Claim }) {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const [kind, setKind] = useState<'accept' | 'contest' | 'insurance'>('accept')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [insurer, setInsurer] = useState('')
  const [policy, setPolicy] = useState('')
  const valid = kind === 'accept' || (kind === 'contest' ? !!reason.trim() : !!insurer.trim() && !!policy.trim())
  const send = () => {
    useDemoStore.getState().respondToClaim(c.id, kind === 'accept' ? { kind } : kind === 'contest' ? { kind, reason, files } : { kind, insurer, policy }, user.id)
    toast.success(t(`pp22.done.${kind}`))
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="rs-h">
      <h2 id="rs-h" className="font-semibold">
        {t('pp22.response')}
      </h2>
      <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="flex flex-wrap gap-4" aria-label={t('pp22.response')}>
        {(['accept', 'contest', 'insurance'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <RadioGroupItem value={k} /> {t(`pp22.r.${k}`)}
          </label>
        ))}
      </RadioGroup>
      {kind === 'contest' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pp22.reason')} htmlFor="pp22-r" required>
            <Input id="pp22-r" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t('pp22.files')} htmlFor="pp22-f">
            <input id="pp22-f" type="file" multiple className="text-caption" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
          </Field>
        </div>
      )}
      {kind === 'insurance' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pp22.insurer')} htmlFor="pp22-i" required>
            <Input id="pp22-i" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
          </Field>
          <Field label={t('pp22.policy')} htmlFor="pp22-p" required>
            <Input id="pp22-p" value={policy} onChange={(e) => setPolicy(e.target.value)} />
          </Field>
        </div>
      )}
      <Button className="self-start" disabled={!valid} onClick={send}>
        {t('pp22.send')}
      </Button>
    </section>
  )
}
