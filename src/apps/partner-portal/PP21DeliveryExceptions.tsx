/**
 * PP-21 Delivery exceptions (NDR and RTO) — docs/02-partner-portal.md. Source
 * §5.1 "NDR: reason code + photo of location; action follows customer's
 * choice"; §7 Step 10. "Dispute NDR" (fake-attempt complaints) is not in the
 * client document.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Ndr } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { usePartnerSession } from './usePartnerSession'

const CHOICE_TONE: Record<NonNullable<Ndr['customerChoice']> | 'awaiting', Tone> = { awaiting: 'warning', reattempt: 'info', changeSlot: 'info', rto: 'danger' }

export default function PP21DeliveryExceptions() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const [tab, setTab] = useState<'ndr' | 'rto'>('ndr')
  const ndrs = Object.values(data.ndrs)
    .filter((n) => n.legId && data.legs[n.legId]?.partnerId === partner.id)
    .sort((a, b) => b.at.localeCompare(a.at))
  const rto = Object.values(data.shipments).filter((s) => s.status === 'returnToOrigin' && s.legIds.some((id) => data.legs[id].partnerId === partner.id && data.legs[id].type === 'lastMile'))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp21.title')} subtitle={t('pp21.subtitle')} className="mb-0" />
      <div role="tablist" aria-label={t('pp21.title')} className="flex gap-2 border-b">
        {(['ndr', 'rto'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('px-3 pb-2 font-medium text-muted-foreground', tab === k && 'border-b-2 border-primary font-semibold text-foreground')}>
            {t(`pp21.tab.${k}`)} <span className="tabular text-caption">{k === 'ndr' ? ndrs.length : rto.length}</span>
          </button>
        ))}
      </div>

      {tab === 'ndr' &&
        (ndrs.length === 0 ? (
          <EmptyState title={t('pp21.empty')} className="rounded-xl border bg-card" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="ndrs">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('pp21.col.job')}</th>
                  <th>{t('pp21.col.attempt')}</th>
                  <th>{t('pp21.col.instruction')}</th>
                  <th>{t('pp21.col.assigned')}</th>
                </tr>
              </thead>
              <tbody>
                {ndrs.map((n) => (
                  <NdrRow key={n.id} n={n} />
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'rto' &&
        (rto.length === 0 ? (
          <EmptyState title={t('pp21.noRto')} className="rounded-xl border bg-card" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="rto">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('pp21.col.lr')}</th>
                  <th>{t('pp21.col.consignee')}</th>
                  <th>{t('pp21.col.rtoAt')}</th>
                  <th>{t('pp21.col.origin')}</th>
                </tr>
              </thead>
              <tbody>
                {rto.map((s) => {
                  const ev = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'rtoInitiated')
                  const c = data.consignees[s.consigneeId]
                  return (
                    <tr key={s.id} className="border-b last:border-0" aria-label={s.id}>
                      <td className="tabular px-4 py-2">{s.id}</td>
                      <td>
                        {c.company || c.contact}, {data.pincodes[s.destPincode].city}
                      </td>
                      <td className="tabular">{ev ? formatDateTime(ev.at) : '—'}</td>
                      <td>{data.pincodes[s.originPincode].city}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      <p className="text-caption text-muted-foreground">{t('pp21.rule')}</p>
    </div>
  )
}

function NdrRow({ n }: { n: Ndr }) {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const leg = data.legs[n.legId!]
  const latest = Object.values(data.ndrs).filter((x) => x.shipmentId === n.shipmentId).every((x) => x.attempt <= n.attempt)
  const riders = Object.values(data.fieldStaff).filter((f) => f.partnerId === partner.id && f.role === 'rider')
  const [rider, setRider] = useState(leg.staffId ?? riders[0]?.id ?? '')
  const choice = n.customerChoice ?? 'awaiting'
  const canAssign = latest && (choice === 'reattempt' || choice === 'changeSlot') && leg.status === 'assigned'
  return (
    <tr className="border-b align-top last:border-0" aria-label={leg.id}>
      <td className="px-4 py-2">
        <Link to={`/partner/jobs/${leg.id}`} className="tabular font-medium text-primary hover:underline">
          {leg.id}
        </Link>
        <span className="tabular block text-caption text-muted-foreground">{n.shipmentId}</span>
      </td>
      <td>
        {n.attempt} · {t(`ndr.reason.${n.reason}`)}
        <span className="block text-caption text-muted-foreground">
          {formatDateTime(n.at)}
          {n.note && ` · ${n.note}`} · {t('pp21.photo')}
        </span>
      </td>
      <td>
        <Chip tone={CHOICE_TONE[choice]}>{t(`pp21.choice.${choice}`)}</Chip>
        {(choice === 'reattempt' || choice === 'changeSlot') && latest && (
          <span className="tabular block text-caption text-muted-foreground">{t('pp21.slot', { date: formatDate(leg.window.from), from: formatTime(leg.window.from), to: formatTime(leg.window.to) })}</span>
        )}
      </td>
      <td className="py-2">
        {canAssign ? (
          <div className="flex items-center gap-2">
            <NativeSelect aria-label={t('pp21.col.assigned')} value={rider} onChange={(e) => setRider(e.target.value)} className="h-8 w-40">
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              size="sm"
              onClick={() => {
                useDemoStore.getState().assignReattempt(leg.id, rider, user.id)
                toast.success(t('pp21.assigned', { name: data.fieldStaff[rider].name }))
              }}
            >
              {t('pp21.assign')}
            </Button>
          </div>
        ) : (
          <span>{leg.staffId ? data.fieldStaff[leg.staffId]?.name : '—'}</span>
        )}
      </td>
    </tr>
  )
}
