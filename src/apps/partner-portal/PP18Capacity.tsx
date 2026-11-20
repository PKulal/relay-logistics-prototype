/**
 * PP-18 Capacity calendar — docs/02-partner-portal.md. Source §5.1 "Declare
 * Capacity: partner sets daily capacity and holidays in the capacity calendar;
 * the assignment engine respects it"; §8 capacity check. One daily capacity per
 * partner (as declared at onboarding). "Pause new jobs" is not in the client
 * document.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { utilisation } from '@shared/engines/network'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Switch } from '@shared/ui/switch'
import { usePartnerSession } from './usePartnerSession'

const monthStart = (d: string) => `${d.slice(0, 7)}-01`
const nextMonth = (d: string) => {
  const [y, m] = d.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}
const daysIn = (first: string) => Math.round((Date.parse(`${nextMonth(first)}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000)
const heat = (pct: number) => (pct >= 90 ? 'bg-status-danger-bg text-status-danger' : pct >= 70 ? 'bg-status-warning-bg text-status-warning' : pct > 0 ? 'bg-status-success-bg text-status-success' : '')

export default function PP18Capacity() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const today = istDate(now)
  const [cap, setCap] = useState(String(partner.capacityPerDay))
  const [picked, setPicked] = useState<string>()
  const recent = utilisation(data, partner.id, addDaysToDate(today, -13), 28).filter((d) => d.capacity)
  const avg = recent.length ? Math.round(recent.reduce((s, d) => s + d.pct, 0) / recent.length) : 0
  const months = [monthStart(today), nextMonth(today)]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp18.title')} subtitle={t('pp18.subtitle')} className="mb-0" />
      <section className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5 shadow-card">
        <Field label={t('pp18.default')} htmlFor="cap-default" hint={t('pp18.defaultHint')} className="w-56">
          <Input id="cap-default" type="number" min={1} className="tabular" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Button
          disabled={Number(cap) === partner.capacityPerDay || !(Number(cap) > 0)}
          onClick={() => {
            useDemoStore.getState().setCapacity(partner.id, { capacityPerDay: Number(cap) }, user.id)
            toast.success(t('pp18.saved'))
          }}
        >
          {t('pp18.save')}
        </Button>
        <p className="ml-auto text-right" data-testid="avg">
          <span className="block text-caption text-muted-foreground">{t('pp18.avg')}</span>
          <span className="tabular font-heading text-section font-bold">{avg}%</span>
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {months.map((first) => {
          const days = utilisation(data, partner.id, first, daysIn(first))
          const lead = (new Date(`${first}T12:00:00+05:30`).getUTCDay() + 6) % 7
          return (
            <section key={first} className="rounded-xl border bg-card p-4 shadow-card" aria-label={formatDate(first).slice(3)}>
              <h2 className="mb-2 font-semibold">{formatDate(first).slice(3)}</h2>
              <div className="grid grid-cols-7 gap-1 text-center text-caption">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => (
                  <span key={d} className="text-muted-foreground">
                    {t(`pp18.d.${d}`)}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {days.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    aria-label={formatDate(d.date)}
                    aria-pressed={picked === d.date}
                    disabled={d.date < today}
                    onClick={() => setPicked(d.date)}
                    className={cn('flex min-h-12 flex-col items-center justify-center rounded-md border', d.closed ? 'bg-muted text-muted-foreground line-through' : heat(d.pct), picked === d.date && 'ring-2 ring-primary', d.date === today && 'font-bold', d.date < today && 'opacity-60')}
                  >
                    <span>{Number(d.date.slice(8))}</span>
                    <span className="tabular text-[11px]">{d.closed ? t('pp18.closed') : d.override !== undefined ? `${d.override}` : `${d.pct}%`}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      {picked && <DayEditor key={picked} date={picked} onDone={() => setPicked(undefined)} />}
      <p className="text-caption text-muted-foreground">{t('pp18.rule')}</p>
    </div>
  )
}

function DayEditor({ date, onDone }: { date: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const [day] = utilisation(data, partner.id, date, 1)
  const [closed, setClosed] = useState(day.closed)
  const [override, setOverride] = useState(day.override !== undefined ? String(day.override) : '')
  const save = () => {
    useDemoStore.getState().setCapacity(partner.id, { closed: { [date]: closed }, overrides: { [date]: override.trim() ? Number(override) : null } }, user.id)
    toast.success(t('pp18.daySaved', { date: formatDate(date) }))
    onDone()
  }
  return (
    <section className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-primary bg-card p-5 shadow-card" aria-label={t('pp18.dayTitle', { date: formatDate(date) })} data-testid="day-editor">
      <div>
        <h2 className="font-semibold">{t('pp18.dayTitle', { date: formatDate(date) })}</h2>
        <p className="tabular text-caption text-muted-foreground">{t('pp18.dayLoad', { jobs: day.jobs, capacity: day.capacity })}</p>
      </div>
      <label className="flex items-center gap-2">
        <Switch checked={closed} onCheckedChange={setClosed} aria-label={t('pp18.closedDay')} /> {t('pp18.closedDay')}
      </label>
      <Field label={t('pp18.override')} htmlFor="cap-ovr" hint={t('pp18.overrideHint', { n: partner.capacityPerDay })} className="w-48">
        <Input id="cap-ovr" type="number" min={0} className="tabular" disabled={closed} value={override} onChange={(e) => setOverride(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={save}>{t('pp18.saveDay')}</Button>
        <Button variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </section>
  )
}
