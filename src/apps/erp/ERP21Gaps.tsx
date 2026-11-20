/**
 * ERP-21 Coverage gaps and forecasts — docs/04-erp-control-tower.md.
 * Source §11 Dept 6 (coverage-gap maps, lane forecasts), §12 (demand
 * forecasting, Phase 2: SIMULATED values). Partner coverage change requests
 * (PP-19) are decided here; a recruitment need raises the network-fit score of
 * matching applicants (ERP-11).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { coverageGaps, laneForecast, pincodeCoverage } from '@shared/engines/network'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { CoverageRequest } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { MapView } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

export default function ERP21Gaps() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const cov = pincodeCoverage(data)
  const gaps = coverageGaps(data, now)
  const lanes = Object.values(data.lanes)
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? '')
  const forecast = laneId ? laneForecast(data, laneId, now) : undefined
  const requests = Object.values(data.coverageRequests).sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.requestedAt.localeCompare(a.requestedAt))
  const markers = Object.values(data.pincodes)
    .filter((p) => p.serviceable)
    .map((p) => {
      const n = Math.min(cov[p.code].firstMile.length, cov[p.code].lastMile.length)
      return { id: p.code, lat: p.lat, lng: p.lng, label: `${p.code} ${p.area}, ${p.city}: ${t('erp21.mapCount', { count: n })}`, tone: n >= 2 ? ('success' as const) : n === 1 ? ('warning' as const) : ('danger' as const) }
    })
  const place = (g: { legType: string; place: string }) => (g.legType === 'lineHaul' ? `${data.lanes[g.place].originRegion} → ${data.lanes[g.place].destRegion}` : `${data.pincodes[g.place].area}, ${data.pincodes[g.place].city} · ${g.place}`)
  const needOpen = (legType: string, p: string) => Object.values(data.recruitmentNeeds).some((n) => n.open && n.legType === legType && n.place === p)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp21.title')} subtitle={t('erp21.subtitle')} className="mb-0" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp21.map')}>
          <h2 className="font-heading text-section font-semibold">{t('erp21.map')}</h2>
          <MapView markers={markers} ariaLabel={t('erp21.map')} className="h-72" />
          <p className="flex flex-wrap gap-2 text-caption">
            <Chip tone="success">{t('erp21.legend.two')}</Chip>
            <Chip tone="warning">{t('erp21.legend.one')}</Chip>
            <Chip tone="danger">{t('erp21.legend.none')}</Chip>
          </p>
        </section>
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp21.forecast')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
              {t('erp21.forecast')} <SimulatedTag />
            </h2>
            <NativeSelect aria-label={t('erp21.lane')} value={laneId} onChange={(e) => setLaneId(e.target.value)} className="h-8 w-56">
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.originRegion} → {l.destRegion}
                </option>
              ))}
            </NativeSelect>
          </div>
          {forecast && (
            <>
              <p className="text-caption text-muted-foreground" data-testid="forecast-growth">
                {t('erp21.growth', { pct: forecast.growthPct })}
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.days.map((d) => ({ ...d, day: formatDate(d.date).slice(0, 6) }))} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="volume" name={t('erp21.volume')} stroke="var(--accent)" strokeWidth={2} isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="capacity" name={t('erp21.capacity')} stroke="var(--color-gray-400)" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp21.gaps')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp21.gaps')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="gaps">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp21.col.place')}</th>
              <th>{t('erp21.col.leg')}</th>
              <th className="text-right">{t('erp21.col.demand')}</th>
              <th>{t('erp21.col.partners')}</th>
              <th>{t('erp21.col.action')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.key} className="border-b last:border-0" aria-label={`${place(g)} ${t(`legType.${g.legType}`)}`}>
                <td className="px-4 py-2">{place(g)}</td>
                <td>{t(`legType.${g.legType}`)}</td>
                <td className="tabular text-right">{g.demand}</td>
                <td>{g.partners.length ? g.partners.map((id) => data.partners[id].shortName).join(', ') : '—'}</td>
                <td>
                  <Chip tone={g.action === 'recruit' ? 'danger' : 'warning'}>{t(`erp21.action.${g.action}`)}</Chip>
                </td>
                <td className="py-2 text-right">
                  {needOpen(g.legType, g.place) ? (
                    <span className="text-caption text-muted-foreground">{t('erp21.needOpen')}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        useDemoStore.getState().createRecruitmentNeed(g.legType, g.place, user.id)
                        toast.success(t('erp21.needCreated'))
                      }}
                    >
                      {t('erp21.createNeed')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp21.requests')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp21.requests')}</h2>
        {requests.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp21.noRequests')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="coverage-requests">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp21.col.request')}</th>
                <th>{t('erp21.col.partner')}</th>
                <th>{t('erp21.col.change')}</th>
                <th>{t('erp21.col.from')}</th>
                <th>{t('erp21.col.reason')}</th>
                <th>{t('erp21.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <RequestRow key={r.id} r={r} by={user.id} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function RequestRow({ r, by }: { r: CoverageRequest; by: string }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [note, setNote] = useState('')
  const what = [...r.pincodes.map((c) => `${c} ${data.pincodes[c]?.area ?? ''}`), ...r.laneIds.map((l) => `${data.lanes[l].originRegion} → ${data.lanes[l].destRegion}`)].join(', ')
  return (
    <tr className="border-b align-top last:border-0" aria-label={r.id}>
      <td className="tabular px-4 py-2">{r.id}</td>
      <td>{data.partners[r.partnerId].shortName}</td>
      <td>
        {t(`erp21.${r.action}`)}: {what}
      </td>
      <td className="tabular">{formatDate(r.effectiveFrom)}</td>
      <td>
        {r.reason}
        <span className="block text-caption text-muted-foreground">{formatDateTime(r.requestedAt)}</span>
      </td>
      <td className="py-2">
        {r.status === 'pending' ? (
          <div className="flex w-64 flex-col gap-1">
            <Input aria-label={t('erp21.noteX', { id: r.id })} placeholder={t('erp21.note')} value={note} onChange={(e) => setNote(e.target.value)} className="h-8" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => (useDemoStore.getState().decideCoverageChange(r.id, true, note, by), toast.success(t('erp21.approved', { id: r.id })))}>
                {t('erp21.approve')}
              </Button>
              <Button size="sm" variant="outline" disabled={!note.trim()} onClick={() => (useDemoStore.getState().decideCoverageChange(r.id, false, note, by), toast.success(t('erp21.rejected', { id: r.id })))}>
                {t('erp21.reject')}
              </Button>
            </div>
          </div>
        ) : (
          <Chip tone={r.status === 'approved' ? 'success' : 'neutral'}>{t(`erp21.status.${r.status}`)}</Chip>
        )}
      </td>
    </tr>
  )
}
