/**
 * PP-15 Live operations board — docs/02-partner-portal.md. Source §5.1
 * (partner operations), §11.1 Control Tower (partner-side view, assumed).
 * Today's jobs by stage, a map of staff and jobs (SIMULATED GPS from the last
 * scan), jobs at SLA risk and the staff list. Quick reassign opens PP-14;
 * calls are masked (SIMULATED).
 */
import { Phone, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { BOARD_COLUMNS, jobPins, liveBoard, partnerAtRisk, staffToday, type BoardColumn } from '@shared/engines/partnerOps'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDuration, formatTime } from '@shared/lib/format'
import type { Leg } from '@shared/types'
import { Button } from '@shared/ui/button'
import { MapView, type MapMarker } from '@shared/ui/MapView'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { reasonText } from '@apps/erp/ERP06AtRisk'
import { usePartnerSession } from './usePartnerSession'

const COL_TONE: Record<BoardColumn, 'info' | 'neutral' | 'warning' | 'success' | 'danger'> = { accepted: 'neutral', assigned: 'info', inProgress: 'warning', done: 'success', failed: 'danger' }
const STATE_TONE = { onDuty: 'success', idle: 'warning', offline: 'neutral' } as const

export default function PP15LiveBoard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const board = liveBoard(data, partner.id, now)
  const risks = partnerAtRisk(data, partner.id, now)
  const staff = staffToday(data, partner.id, now)
  const [view, setView] = useState<'board' | 'map'>('board')
  const open = [...board.accepted, ...board.assigned, ...board.inProgress]
  const markers: MapMarker[] = [
    ...staff.filter((s) => s.position).map((s) => ({ id: `s-${s.staff.id}`, ...s.position!, tone: STATE_TONE[s.state], label: `${s.staff.name} · ${t(`pp15.state.${s.state}`)}`, emphasis: true })),
    ...jobPins(data, open, now).map((p) => ({ id: `j-${p.leg.id}`, lat: p.lat, lng: p.lng, tone: 'info' as const, label: `${p.leg.id} · ${p.leg.shipmentId}`, onClick: () => navigate(`/partner/jobs/${p.leg.id}`) })),
  ]
  const call = (name: string) => toast.success(t('pp15.calling', { name }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp15.title')}
        subtitle={t('pp15.subtitle', { jobs: open.length, onDuty: staff.filter((s) => s.state === 'onDuty').length })}
        actions={
          <div role="tablist" aria-label={t('pp15.title')} className="flex rounded-lg border bg-card p-0.5">
            {(['board', 'map'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1 text-caption font-medium', view === v && 'bg-primary text-primary-foreground')}>
                {t(`pp15.view.${v}`)}
              </button>
            ))}
          </div>
        }
        className="mb-0"
      />

      {view === 'board' ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-5" data-testid="board">
          {BOARD_COLUMNS.map((c) => (
            <section key={c} className="flex min-w-48 flex-col gap-2 rounded-xl border bg-muted/40 p-2" aria-label={t(`pp15.col.${c}`)}>
              <h2 className="flex items-center justify-between px-1 text-caption font-semibold">
                {t(`pp15.col.${c}`)} <Chip tone={COL_TONE[c]}>{board[c].length}</Chip>
              </h2>
              {board[c].length === 0 && <p className="px-1 text-caption text-muted-foreground">{t('pp15.none')}</p>}
              {board[c].slice(0, 12).map((l) => (
                <JobCard key={l.id} leg={l} />
              ))}
              {board[c].length > 12 && <p className="px-1 text-caption text-muted-foreground">{t('pp15.more', { count: board[c].length - 12 })}</p>}
            </section>
          ))}
        </div>
      ) : (
        <div>
          <MapView markers={markers} className="h-96" ariaLabel={t('pp15.map')} />
          <p className="mt-1 flex items-center gap-2 text-caption text-muted-foreground">
            {t('pp15.mapNote')} <SimulatedTag />
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp15.atRisk')}>
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp15.atRisk')}</h2>
          {risks.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t('pp15.noRisk')}</p>
          ) : (
            <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="at-risk">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('pp15.c.job')}</th>
                  <th>{t('pp15.c.staff')}</th>
                  <th>{t('pp15.c.left')}</th>
                  <th>{t('pp15.c.reason')}</th>
                  <th className="sr-only">{t('pp15.c.action')}</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.leg.id} className="border-b last:border-0" aria-label={r.leg.id}>
                    <td className="px-4 py-2">
                      <Link to={`/partner/jobs/${r.leg.id}`} className="tabular text-primary hover:underline">
                        {r.leg.id}
                      </Link>
                      <span className="block text-caption text-muted-foreground">{t('pp15.risk', { pct: r.risk })}</span>
                    </td>
                    <td>{r.leg.staffId ? data.fieldStaff[r.leg.staffId]?.name : '—'}</td>
                    <td className={cn('tabular', r.minutesLeft < 60 && 'font-semibold text-status-danger')}>{r.minutesLeft < 0 ? t('pp15.late', { d: formatDuration(-r.minutesLeft) }) : formatDuration(r.minutesLeft)}</td>
                    <td className="text-caption">{r.reason ? reasonText(t, data, r.reason) : '—'}</td>
                    <td className="py-2 text-right">
                      {['accepted', 'assigned'].includes(r.leg.status) && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/partner/jobs/assign?ids=${r.leg.id}`)}>
                          <UserRoundCog /> {t('pp15.reassign')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp15.staff')}>
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp15.staff')}</h2>
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="staff-today">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp15.c.name')}</th>
                <th>{t('pp15.c.jobs')}</th>
                <th>{t('pp15.c.lastScan')}</th>
                <th>{t('pp15.c.status')}</th>
                <th className="sr-only">{t('pp15.c.action')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.staff.id} className="border-b last:border-0" aria-label={s.staff.name}>
                  <td className="px-4 py-2">
                    {s.staff.name} <span className="text-caption text-muted-foreground">· {t(`pp09.role.${s.staff.role}`)}</span>
                  </td>
                  <td className="tabular">
                    {s.done}/{s.total}
                  </td>
                  <td className="tabular text-caption">{s.lastScan ? formatTime(s.lastScan) : '—'}</td>
                  <td>
                    <Chip tone={STATE_TONE[s.state]}>{t(`pp15.state.${s.state}`)}</Chip>
                  </td>
                  <td className="py-1.5 text-right">
                    <Button size="sm" variant="ghost" aria-label={t('pp15.call', { name: s.staff.name })} onClick={() => call(s.staff.name)}>
                      <Phone />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function JobCard({ leg }: { leg: Leg }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const s = data.shipments[leg.shipmentId]
  return (
    <Link to={`/partner/jobs/${leg.id}`} className="flex flex-col gap-0.5 rounded-lg border bg-card p-2 text-caption hover:bg-accent">
      <span className="tabular font-semibold">{leg.id}</span>
      <span className="text-muted-foreground">
        {t(`legType.${leg.type}`)} · {data.pincodes[s.destPincode]?.city}
      </span>
      <span>
        {leg.staffId ? data.fieldStaff[leg.staffId]?.name : t('pp15.unassigned')} · {t('pp15.by', { time: formatTime(leg.window.to) })}
      </span>
    </Link>
  )
}
