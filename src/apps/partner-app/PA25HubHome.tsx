/**
 * PA-25 Hub home (shift view) — docs/03-partner-app.md §6.5.
 * What the hub is expecting and what is waiting at each stage.
 */
import { ChevronRight, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { departures, hubTiles, toneOf } from '@shared/engines/hub'
import { formatDayShort, formatTime } from '@shared/lib/format'
import { istDate, isBefore } from '@shared/lib/time'
import { AccessDenied } from '@shared/ui/Page'
import { TONE_CLASS, useHub } from './useHub'

export default function PA25HubHome() {
  const { t } = useTranslation()
  const { staff, data, now, hubId, hub, items } = useHub()
  if (!hubId || !hub) return <div className="p-4"><AccessDenied /></div>

  const tiles = hubTiles(data, hubId, items)
  const expected = items.filter((i) => i.stage === 'expected')
  const leaving = departures(data, hubId)
  const TILES: { key: keyof typeof tiles; to: string; danger?: boolean }[] = [
    { key: 'toInScan', to: '/app/inbound' },
    { key: 'toSort', to: '/app/hub/sort' },
    { key: 'bagsOpen', to: '/app/hub/bags' },
    { key: 'bagsToSeal', to: '/app/hub/bags' },
    { key: 'toDispatch', to: '/app/outbound' },
    { key: 'exceptions', to: '/app/hub/exceptions', danger: true },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold">{t('pa05.hello', { name: staff.name.split(' ')[0] })}</h1>
        <p className="text-muted-foreground">{t('pa25.shift', { hub: hub.name, hours: hub.hours })}</p>
      </div>

      {/* Stage tiles */}
      <section aria-label={t('pa25.stages')} className="grid grid-cols-3 gap-2">
        {TILES.map(({ key, to, danger }) => (
          <Link key={key} to={to} className="flex min-h-20 flex-col items-center justify-center rounded-2xl border bg-card p-2 text-center active:bg-gray-100">
            <span className={cn('tabular font-heading text-[26px] font-bold', danger && tiles[key] > 0 && 'text-status-danger')}>{tiles[key]}</span>
            <span className="text-[12px] leading-tight text-muted-foreground">{t(`pa25.tile.${key}`)}</span>
          </Link>
        ))}
      </section>

      {/* Inbound expected */}
      <section aria-labelledby="in-h" className="flex flex-col gap-2">
        <h2 id="in-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa25.inbound')} · {expected.length}
        </h2>
        {expected.length === 0 ? (
          <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa25.noInbound')}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {expected.map((i) => {
              const by = i.from.staffId ? data.fieldStaff[i.from.staffId]?.name : undefined
              const late = isBefore(i.eta, now)
              const row = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {data.partners[i.from.partnerId].shortName}
                      {by ? ` · ${by}` : ''} · {t('pa25.pcs', { count: i.pieceIds.length })}
                    </p>
                    <p className="tabular truncate text-[13px] text-muted-foreground">
                      {i.shipment.id} · {t(`pa25.from.${i.from.type}`)}
                    </p>
                  </div>
                  <span className={cn('tabular shrink-0 font-semibold', late && 'text-status-danger')}>
                    {istDate(i.eta) === istDate(now) ? formatTime(i.eta) : `${formatDayShort(i.eta)} ${formatTime(i.eta)}`}
                  </span>
                </>
              )
              return (
                <li key={i.leg.id}>
                  {i.leg.staffId === staff.id ? (
                    <Link to={`/app/tasks/${i.leg.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-gray-100">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
                      {row}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Outbound departures */}
      <section aria-labelledby="out-h" className="flex flex-col gap-2">
        <h2 id="out-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa25.departures')}
        </h2>
        {leaving.length === 0 ? (
          <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa25.noDepartures')}</p>
        ) : (
          leaving.map((d) => (
            <Link key={d.trip.id} to="/app/outbound" className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-2">
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full border-2', TONE_CLASS[toneOf(d.destKey)])}>
                <Truck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {d.name} · {formatTime(d.trip.departAt)}
                </p>
                <p className="tabular truncate text-[13px] text-muted-foreground">
                  {d.vehicle?.regNo} · {t('pa25.bags', { count: d.bags })} · {t(`pa25.trip.${d.trip.status}`)}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          ))
        )}
      </section>
    </div>
  )
}

