/**
 * PP-12 Job inbox — docs/02-partner-portal.md §6.4.
 * Jobs Logisco has given this partner, with SLA clocks. Accept, accept and
 * assign, flag as not serviceable, bulk accept. A booking confirmed in the
 * Customer Portal appears here within a second (shared store + tab sync).
 */
import { Check, Flag, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { acceptBy, JOB_TABS, JOB_TYPE, jobEnds, jobSpecials, jobTab, partnerLegs, type JobTab, type JobType } from '@shared/engines/partnerJobs'
import { legSla } from '@shared/engines/sla'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDayShort, formatINR, formatKg } from '@shared/lib/format'
import { useSimulatedLoading } from '@shared/sim/latency'
import { useDemoStore } from '@shared/store'
import type { Leg } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { DataTable, type Column } from '@shared/ui/DataTable'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SlaBadge } from '@shared/ui/SlaBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { LegStatusChip } from '@shared/ui/StatusChip'
import { AcceptByChip, FlagDialog, SpecialIcons } from './JobBits'
import { usePartnerSession } from './usePartnerSession'

const JOB_TYPES: JobType[] = ['pickup', 'hubOutbound', 'lineHaul', 'hubInbound', 'delivery']

export default function PP12JobInbox() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const tab = (params.get('tab') as JobTab) || 'offered'
  const [type, setType] = useState<JobType | ''>('')
  const [date, setDate] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [flagging, setFlagging] = useState<string>()
  const loading = useSimulatedLoading(tab)

  const legs = useMemo(() => partnerLegs(data, partner.id), [data, partner.id])
  const counts = useMemo(() => Object.fromEntries(JOB_TABS.map((k) => [k, legs.filter((l) => jobTab(l) === k).length])) as Record<JobTab, number>, [legs])
  const dates = useMemo(() => [...new Set(legs.filter((l) => jobTab(l) === tab).map((l) => l.window.from.slice(0, 10)))].sort(), [legs, tab])
  const rows = useMemo(
    () =>
      legs.filter((l) => {
        if (jobTab(l) !== tab) return false
        if (type && JOB_TYPE[l.type] !== type) return false
        if (date && !l.window.from.startsWith(date)) return false
        if (q) {
          const s = data.shipments[l.shipmentId]
          const text = `${l.id} ${s.id} ${s.originPincode} ${s.destPincode}`.toLowerCase()
          if (!text.includes(q.trim().toLowerCase())) return false
        }
        return true
      }),
    [legs, tab, type, date, q, data.shipments],
  )

  const setTab = (k: JobTab) => {
    setSelected([])
    setParams({ tab: k })
  }
  const accept = (ids: string[], thenAssign = false) => {
    useDemoStore.getState().acceptLegs(ids, user.id)
    toast.success(t('pp12.accepted', { count: ids.length }))
    setSelected([])
    if (thenAssign) navigate(`/partner/jobs/assign?ids=${ids.join(',')}`)
  }

  const visibleIds = rows.map((r) => r.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const selectable = tab === 'offered' || tab === 'accepted'

  const columns: Column<Leg>[] = [
    ...(selectable
      ? [
          {
            key: 'select',
            header: <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? visibleIds : [])} aria-label={t('pp12.selectAll')} />,
            cell: (l: Leg) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} aria-label={t('pp12.select', { job: l.id })} />
              </span>
            ),
          },
        ]
      : []),
    { key: 'job', header: t('pp12.col.job'), cell: (l) => <span className="font-semibold text-primary">{l.id}</span>, sortValue: (l) => l.id },
    { key: 'type', header: t('pp12.col.type'), cell: (l) => t(`pp.jobType.${JOB_TYPE[l.type]}`), sortValue: (l) => JOB_TYPE[l.type] },
    {
      key: 'route',
      header: t('pp12.col.route'),
      cell: (l) => {
        const e = jobEnds(data, l, data.shipments[l.shipmentId])
        return (
          <span className="block max-w-64 min-w-40 whitespace-normal">
            {e.from.name} {e.from.pincode} → {e.to.name}
          </span>
        )
      },
    },
    {
      key: 'pieces',
      header: t('pp12.col.pieces'),
      cell: (l) => {
        const s = data.shipments[l.shipmentId]
        return `${t('pp.pcs', { count: s.pieces.length })} / ${formatKg(s.weights.actual)}`
      },
    },
    {
      key: 'window',
      header: t('pp12.col.window'),
      cell: (l) => (
        <span className="block whitespace-nowrap">
          {formatDayShort(l.window.from)}
          <span className="block text-caption text-muted-foreground">
            {l.window.from.slice(11, 16)}–{l.window.to.slice(11, 16)}
          </span>
        </span>
      ),
      sortValue: (l) => l.window.from,
    },
    { key: 'payout', header: t('pp12.col.payout'), cell: (l) => formatINR(l.cost), sortValue: (l) => l.cost, align: 'right' },
    tab === 'offered'
      ? { key: 'acceptBy', header: t('pp12.col.acceptBy'), cell: (l) => <AcceptByChip acceptBy={acceptBy(data, l)} now={now} />, sortValue: (l) => acceptBy(data, l) }
      : { key: 'sla', header: t('pp12.col.sla'), cell: (l) => (tab === 'completed' ? <LegStatusChip status={l.status} /> : <SlaBadge state={legSla(l, now)} dueAt={l.slaDueAt} now={now} />) },
    { key: 'special', header: t('pp12.col.special'), cell: (l) => <SpecialIcons specials={jobSpecials(data, l, data.shipments[l.shipmentId])} /> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('erp05.col.actions')}</span>,
      cell: (l) => (
        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {tab === 'offered' && (
            <>
              <Button size="xs" onClick={() => accept([l.id])}>
                <Check /> {t('pp12.accept')}
              </Button>
              <IconAction label={t('pp12.acceptAssign')} onClick={() => accept([l.id], true)}>
                <UserPlus />
              </IconAction>
              <IconAction label={t('pp12.flag', { job: l.id })} onClick={() => setFlagging(l.id)}>
                <Flag />
              </IconAction>
            </>
          )}
          {(tab === 'accepted' || tab === 'assigned') && (
            <Button size="xs" variant="outline" onClick={() => navigate(`/partner/jobs/assign?ids=${l.id}`)}>
              <UserPlus /> {tab === 'accepted' ? t('pp12.assign') : t('pp12.reassign')}
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp12.title')} subtitle={t('pp12.subtitle', { partner: partner.shortName })} className="mb-0" />

      <div role="tablist" aria-label={t('pp12.tabs')} className="flex flex-wrap gap-1 border-b">
        {JOB_TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn('-mb-px border-b-2 px-3 py-2 font-medium', tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t(`pp12.tab.${k}`)} <span className="tabular ml-1 rounded-full bg-gray-100 px-1.5 text-caption text-gray-700">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-64" placeholder={t('pp12.search')} aria-label={t('pp12.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <NativeSelect aria-label={t('pp12.jobType')} value={type} onChange={(e) => setType(e.target.value as JobType | '')} className="w-48">
          <option value="">{t('pp12.allTypes')}</option>
          {JOB_TYPES.filter((jt) => legs.some((l) => JOB_TYPE[l.type] === jt)).map((jt) => (
            <option key={jt} value={jt}>
              {t(`pp.jobType.${jt}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('pp12.date')} value={date} onChange={(e) => setDate(e.target.value)} className="w-44">
          <option value="">{t('pp12.allDates')}</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDayShort(d)}
            </option>
          ))}
        </NativeSelect>
        {selected.length > 0 && tab === 'offered' && (
          <Button onClick={() => accept(selected)}>
            <Check /> {t('pp12.bulkAccept', { count: selected.length })}
          </Button>
        )}
        {selected.length > 0 && tab === 'accepted' && (
          <Button onClick={() => navigate(`/partner/jobs/assign?ids=${selected.join(',')}`)}>
            <UserPlus /> {t('pp12.bulkAssign', { count: selected.length })}
          </Button>
        )}
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(l) => l.id}
        loading={loading}
        pageSize={12}
        onRowClick={(l) => navigate(`/partner/jobs/${l.id}`)}
        defaultSort={{ key: 'window', dir: 'asc' }}
        empty={<EmptyState title={t(`pp12.empty.${tab}`)} body={t('pp12.emptyBody')} />}
      />

      {flagging && <FlagDialog legId={flagging} userId={user.id} onClose={() => setFlagging(undefined)} />}
    </div>
  )
}

/** Compact icon button with a tooltip; the label is also its accessible name. */
function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-xs" variant="outline" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
