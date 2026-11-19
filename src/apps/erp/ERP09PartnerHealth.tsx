/**
 * ERP-09 Partner health — docs/04-erp-control-tower.md §6.3.
 * Source §11.1 "Partner Health: who is behind on pickups, which hubs have high
 * dwell time, which trucks have stopped". SOS alerts come from the Partner App
 * SOS button (PA-12, built later in Phase 4).
 */
import { MessageSquare, PhoneCall } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { DWELL_FLAG_HOURS, hubDwell, pickupsBehind, stoppedTrucks } from '@shared/engines/opsReview'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatDuration, formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Id } from '@shared/types'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useErpSession } from './useErpSession'

export default function ERP09PartnerHealth() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const pickups = useMemo(() => pickupsBehind(data, now), [data, now])
  const hubs = useMemo(() => hubDwell(data, now), [data, now])
  const trucks = useMemo(() => stoppedTrucks(data, now), [data, now])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp09.title')} subtitle={t('erp09.subtitle', { time: formatTime(now) })} className="mb-0" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t('erp09.pickups')} empty={pickups.length === 0 ? t('erp09.noPickups') : undefined} testId="pickups">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp09.col.partner')}</th>
                <th className="text-right">{t('erp09.col.due')}</th>
                <th className="text-right">{t('erp09.col.done')}</th>
                <th className="text-right">{t('erp09.col.late')}</th>
                <th className="pl-4">{t('erp09.col.oldest')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pickups.map((p) => (
                <tr key={p.partnerId} className="tabular border-b last:border-0" aria-label={data.partners[p.partnerId].shortName}>
                  <td className="py-2">
                    <Link to={`/erp/control-tower/jobs?partner=${p.partnerId}`} className="text-primary hover:underline">
                      {data.partners[p.partnerId].shortName}
                    </Link>
                  </td>
                  <td className="text-right">{p.due}</td>
                  <td className="text-right">{p.done}</td>
                  <td className={cn('text-right', p.late && 'font-semibold text-status-danger')}>{p.late}</td>
                  <td className="pl-4">{p.oldestLate ? t('erp09.lateBy', { time: formatDuration((Date.parse(now) - Date.parse(p.oldestLate)) / 60000) }) : '—'}</td>
                  <td className="text-right">
                    <Contact partnerId={p.partnerId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t('erp09.hubs', { hours: DWELL_FLAG_HOURS })} empty={hubs.length === 0 ? t('erp09.noHubs') : undefined} testId="hubs">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp09.col.hub')}</th>
                <th className="text-right">{t('erp09.col.inHub')}</th>
                <th className="text-right">{t('erp09.col.avg')}</th>
                <th className="text-right">{t('erp09.col.over', { hours: DWELL_FLAG_HOURS })}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => (
                <tr key={h.hubId} className="tabular border-b last:border-0">
                  <td className="py-2">{data.hubs[h.hubId].name}</td>
                  <td className="text-right">{h.shipments}</td>
                  <td className={cn('text-right', h.avgHours > DWELL_FLAG_HOURS && 'font-semibold text-status-danger')}>{t('erp09.hours', { n: h.avgHours })}</td>
                  <td className={cn('text-right', h.over > 0 && 'font-semibold text-status-danger')}>{h.over}</td>
                  <td className="text-right">
                    <Contact partnerId={data.hubs[h.hubId].partnerId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t('erp09.trucks')} empty={trucks.length === 0 ? t('erp09.noTrucks') : undefined} testId="trucks">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp09.col.trip')}</th>
                <th>{t('erp09.col.lastMove')}</th>
                <th className="text-right">{t('erp09.col.stopped')}</th>
                <th className="pl-4">{t('erp09.col.reason')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trucks.map((x) => {
                const trip = data.trips[x.tripId]
                return (
                  <tr key={x.tripId} className="border-b last:border-0">
                    <td className="tabular py-2">
                      {x.tripId}
                      <span className="block text-caption text-muted-foreground">{data.vehicles[trip.vehicleId]?.regNo}</span>
                    </td>
                    <td className="tabular">{formatDateTime(x.lastMovement)}</td>
                    <td className="tabular text-right font-semibold text-status-warning">{formatDuration(x.minutes)}</td>
                    <td className="pl-4">{x.breakdown ? t('erp09.breakdown') : (x.reason ?? t('erp09.noReason'))}</td>
                    <td className="text-right">
                      <Contact partnerId={data.vehicles[trip.vehicleId]?.partnerId ?? ''} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title={t('erp09.sos')} empty={t('erp09.noSos')} testId="sos">
          {null}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, empty, testId, children }: { title: string; empty?: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={title} data-testid={testId}>
      <h2 className="text-card-title">{title}</h2>
      {empty ? <p className="text-muted-foreground">{empty}</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  )
}

/** SIMULATED masked call / message to the partner's operations desk; logged. */
function Contact({ partnerId }: { partnerId: Id }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const name = useData((d) => d.partners[partnerId]?.shortName ?? '')
  if (!partnerId) return null
  return (
    <span className="inline-flex gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={t('erp09.call', { name })} onClick={() => (useDemoStore.getState().contactPartner(partnerId, 'call', user.id), toast.success(t('erp09.calling', { name })))}>
        <PhoneCall />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('erp09.message', { name })} onClick={() => (useDemoStore.getState().contactPartner(partnerId, 'message', user.id), toast.success(t('erp09.messaged', { name })))}>
        <MessageSquare />
      </Button>
      <SimulatedTag />
    </span>
  )
}
