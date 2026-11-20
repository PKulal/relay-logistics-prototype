/**
 * ERP-40 Hub & PTL Operations: hub monitor and appointment desk —
 * docs/04-erp-control-tower.md. Source §11 Dept 8 (hub scans, manifests, seals,
 * appointment desk; short-excess detection). Load / cube optimisation is
 * Phase 3 (disabled card).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { hubItems } from '@shared/engines/hub'
import { hubDwell } from '@shared/engines/opsReview'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const OPEN_APPOINTMENT = ['booked', 'pickedUp', 'atOriginHub', 'inTransit', 'atDestinationHub', 'undelivered']

export default function ERP40HubOps() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const dwell = hubDwell(data, now)
  const hubs = Object.values(data.hubs).map((h) => {
    const items = hubItems(data, h.id, now)
    const legIds = new Set(items.flatMap((i) => [i.leg.id, i.from.id]))
    const shortExcess = Object.values(data.exceptions).filter((x) => x.status !== 'resolved' && ['short', 'excess', 'sealMismatch', 'damage'].includes(x.type) && x.legId && legIds.has(x.legId)).length
    return { hub: h, inbound: items.filter((i) => i.stage === 'expected').length, inScanned: items.filter((i) => ['toSort', 'sorted', 'sealed'].includes(i.stage)).length, dwell: dwell.find((d) => d.hubId === h.id), shortExcess }
  })
  const manifests = Object.values(data.manifests).sort((a, b) => (b.dispatchedAt ?? '').localeCompare(a.dispatchedAt ?? ''))
  const appointments = Object.values(data.shipments)
    .filter((s) => s.addOns.appointment && OPEN_APPOINTMENT.includes(s.status))
    .sort((a, b) => (a.appointment?.date ?? a.eta).localeCompare(b.appointment?.date ?? b.eta))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp40.title')} subtitle={t('erp40.subtitle')} className="mb-0" />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp40.board')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp40.board')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="hub-board">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp40.col.hub')}</th>
              <th className="text-right">{t('erp40.col.inbound')}</th>
              <th className="text-right">{t('erp40.col.inScanned')}</th>
              <th className="text-right">{t('erp40.col.dwell')}</th>
              <th className="text-right">{t('erp40.col.shortExcess')}</th>
            </tr>
          </thead>
          <tbody>
            {hubs.map((h) => (
              <tr key={h.hub.id} className="border-b last:border-0" aria-label={h.hub.name}>
                <td className="px-4 py-2 font-medium">
                  {h.hub.name}
                  <span className="block text-caption text-muted-foreground">{data.partners[h.hub.partnerId]?.shortName}</span>
                </td>
                <td className="tabular text-right">{h.inbound}</td>
                <td className="tabular text-right">{h.inScanned}</td>
                <td className={cn('tabular text-right', (h.dwell?.over ?? 0) > 0 && 'font-semibold text-status-warning')}>{h.dwell ? t('erp40.hours', { h: h.dwell.avgHours }) : '—'}</td>
                <td className={cn('tabular text-right', h.shortExcess > 0 && 'font-semibold text-status-danger')}>{h.shortExcess}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp40.manifests')}>
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp40.manifests')}</h2>
          {manifests.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t('erp40.noManifests')}</p>
          ) : (
            <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="manifests">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('erp40.col.manifest')}</th>
                  <th>{t('erp40.col.hub')}</th>
                  <th>{t('erp40.col.to')}</th>
                  <th className="text-right">{t('erp40.col.bags')}</th>
                  <th>{t('erp40.col.seals')}</th>
                  <th>{t('erp40.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {manifests.map((m) => (
                  <tr key={m.id} className="border-b last:border-0" aria-label={m.id}>
                    <td className="tabular px-4 py-2">{m.id}</td>
                    <td>{data.hubs[m.hubId]?.name}</td>
                    <td>{m.destination}</td>
                    <td className="tabular text-right">{m.bagIds.length}</td>
                    <td className="tabular text-caption">
                      {m.bagIds.map((b) => data.bags[b]?.sealNo).filter(Boolean).join(', ') || '—'}
                      {m.doorSeal && ` · ${t('erp40.door', { seal: m.doorSeal })}`}
                    </td>
                    <td>
                      <Chip tone={m.status === 'dispatched' ? 'success' : 'info'}>{t(`erp40.ms.${m.status}`)}</Chip>
                      {m.dispatchedAt && <span className="block text-caption text-muted-foreground">{formatDateTime(m.dispatchedAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 opacity-70 shadow-card" aria-label={t('erp40.load')}>
          <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
            {t('erp40.load')} <Chip tone="neutral">{t('erp40.phase3')}</Chip>
          </h2>
          <p className="text-table">{t('erp40.loadBody')}</p>
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp40.desk')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp40.desk')}</h2>
        {appointments.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp40.noAppointments')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="appointments">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp40.col.lr')}</th>
                <th>{t('erp40.col.dc')}</th>
                <th>{t('erp40.col.slot')}</th>
                <th>{t('erp40.col.gatePass')}</th>
                <th>{t('erp40.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((s) => (
                <SlotRow key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function SlotRow({ s }: { s: Shipment }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const a = s.appointment
  const c = data.consignees[s.consigneeId]
  const [edit, setEdit] = useState(false)
  const [date, setDate] = useState(a?.date ?? s.eta)
  const [from, setFrom] = useState(a?.from ?? '10:00')
  const [to, setTo] = useState(a?.to ?? '12:00')
  const save = () => {
    useDemoStore.getState().confirmSlot(s.id, { date, from, to }, user.id)
    setEdit(false)
    toast.success(t('erp40.slotSaved', { lr: s.id }))
  }
  return (
    <tr className="border-b align-top last:border-0" aria-label={s.id}>
      <td className="px-4 py-2">
        <Link to={`/erp/shipments/${s.id}`} className="tabular text-primary hover:underline">
          {s.id}
        </Link>
      </td>
      <td>
        {c.company || c.contact}
        <span className="block text-caption text-muted-foreground">{data.pincodes[s.destPincode].city}</span>
      </td>
      <td>
        {a?.confirmed ? (
          <span className="tabular">
            {formatDate(a.date)} {a.from}–{a.to}
            {a.dock && ` · ${a.dock}`}
          </span>
        ) : (
          <Chip tone="warning">{t('erp40.unconfirmed', { date: formatDate(a?.date ?? s.eta) })}</Chip>
        )}
      </td>
      <td>{a?.gatePass ? <Chip tone="success">{t('erp40.yes')}</Chip> : '—'}</td>
      <td className="py-2">
        {edit ? (
          <div className="flex flex-wrap items-center gap-1">
            <Input aria-label={t('erp40.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36" />
            <Input aria-label={t('erp40.from')} type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-24" />
            <Input aria-label={t('erp40.to')} type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-24" />
            <Button size="sm" disabled={from >= to} onClick={save}>
              {t('erp40.save')}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
            {a?.confirmed ? t('erp40.move') : t('erp40.confirm')}
          </Button>
        )}
      </td>
    </tr>
  )
}
