/**
 * ERP-19 Lanes, hubs and transit times — docs/04-erp-control-tower.md.
 * Source §11 Dept 6 (lanes, hubs, transit times). Saving changes the quotes
 * and ETAs of new bookings; the distance also sets e-way bill validity.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { lanePartners } from '@shared/engines/network'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { Lane, Service } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const SERVICES: Service[] = ['economy', 'standard', 'express', 'expressPtl', 'standardPtl']
const EDIT_ROLES = ['networkPlanning', 'superAdmin']

export default function ERP19Lanes() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [editing, setEditing] = useState<string>()
  const canEdit = EDIT_ROLES.includes(user.role)
  const lanes = Object.values(data.lanes).sort((a, b) => a.originRegion.localeCompare(b.originRegion) || a.destRegion.localeCompare(b.destRegion))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp19.title')} subtitle={t('erp19.subtitle')} className="mb-0" />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="lanes">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp19.col.lane')}</th>
              <th>{t('erp19.col.hubs')}</th>
              {SERVICES.map((s) => (
                <th key={s} className="text-right">
                  {t(`service.${s}`)}
                </th>
              ))}
              <th className="text-right">{t('erp19.col.km')}</th>
              <th>{t('erp19.col.departs')}</th>
              <th>{t('erp19.col.partners')}</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>{lanes.map((l) => (editing === l.id ? <EditRow key={l.id} lane={l} onDone={() => setEditing(undefined)} by={user.id} /> : <Row key={l.id} lane={l} canEdit={canEdit} onEdit={() => setEditing(l.id)} />))}</tbody>
        </table>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp19.hubs')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="hubs">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp19.col.hub')}</th>
              <th>{t('erp19.col.operator')}</th>
              <th>{t('erp19.col.city')}</th>
              <th className="text-right">{t('erp19.col.docks')}</th>
              <th>{t('erp19.col.hours')}</th>
              <th>{t('erp19.col.audit')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(data.hubs).map((h) => (
              <tr key={h.id} className="border-b last:border-0" aria-label={h.name}>
                <td className="px-4 py-2 font-medium">{h.name}</td>
                <td>{data.partners[h.partnerId]?.shortName}</td>
                <td>
                  {data.pincodes[h.pincode]?.city} · <span className="tabular">{h.pincode}</span>
                </td>
                <td className="tabular text-right">{h.docks}</td>
                <td>{h.hours}</td>
                <td>
                  <Chip tone={h.auditStatus === 'passed' ? 'success' : h.auditStatus === 'failed' ? 'danger' : 'warning'}>{t(`erp19.audit.${h.auditStatus}`)}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Row({ lane: l, canEdit, onEdit }: { lane: Lane; canEdit: boolean; onEdit: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const partners = lanePartners(data, l.id)
  return (
    <tr className="border-b last:border-0" aria-label={`${l.originRegion} → ${l.destRegion}`}>
      <td className="px-4 py-2 font-medium">
        {l.originRegion} → {l.destRegion}
      </td>
      <td className="text-caption">
        {data.hubs[l.originHubId]?.name} → {data.hubs[l.destHubId]?.name}
      </td>
      {SERVICES.map((s) => (
        <td key={s} className="tabular text-right">
          {l.transitDays[s]}
        </td>
      ))}
      <td className="tabular text-right">{l.distanceKm.toLocaleString('en-IN')}</td>
      <td className="tabular">{t('erp19.daily', { time: l.departureTime })}</td>
      <td>{partners.length ? partners.map((id) => data.partners[id].shortName).join(', ') : <Chip tone="danger">{t('erp19.noPartner')}</Chip>}</td>
      {canEdit && (
        <td className="py-2 text-right">
          <Button size="sm" variant="outline" onClick={onEdit}>
            {t('erp19.edit')}
          </Button>
        </td>
      )}
    </tr>
  )
}

function EditRow({ lane: l, onDone, by }: { lane: Lane; onDone: () => void; by: string }) {
  const { t } = useTranslation()
  const [days, setDays] = useState<Record<Service, string>>(() => Object.fromEntries(SERVICES.map((s) => [s, String(l.transitDays[s])])) as Record<Service, string>)
  const [km, setKm] = useState(String(l.distanceKm))
  const [dep, setDep] = useState(l.departureTime)
  const save = () => {
    const transitDays = Object.fromEntries(SERVICES.map((s) => [s, Number(days[s])])) as Record<Service, number>
    const before = useDemoStore.getState().data.lanes[l.id]
    useDemoStore.getState().updateLane(l.id, { transitDays, distanceKm: Number(km), departureTime: dep }, by)
    if (useDemoStore.getState().data.lanes[l.id] === before) return toast.error(t('erp19.invalid'))
    toast.success(t('erp19.saved'))
    onDone()
  }
  return (
    <tr className="border-b bg-primary-soft/40" aria-label={`${l.originRegion} → ${l.destRegion}`}>
      <td className="px-4 py-2 font-medium">
        {l.originRegion} → {l.destRegion}
      </td>
      <td />
      {SERVICES.map((s) => (
        <td key={s}>
          <Input aria-label={t('erp19.daysX', { service: t(`service.${s}`) })} type="number" min={1} className="tabular h-8 w-14" value={days[s]} onChange={(e) => setDays({ ...days, [s]: e.target.value })} />
        </td>
      ))}
      <td>
        <Input aria-label={t('erp19.col.km')} type="number" className="tabular h-8 w-20" value={km} onChange={(e) => setKm(e.target.value)} />
      </td>
      <td>
        <Input aria-label={t('erp19.col.departs')} type="time" className="tabular h-8 w-28" value={dep} onChange={(e) => setDep(e.target.value)} />
      </td>
      <td />
      <td className="py-2">
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            {t('erp19.save')}
          </Button>
          <Button size="sm" variant="outline" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </td>
    </tr>
  )
}
