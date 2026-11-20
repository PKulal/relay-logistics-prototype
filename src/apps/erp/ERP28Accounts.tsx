/**
 * ERP-28 Customer account 360 — docs/04-erp-control-tower.md. Source §6 Step 8
 * (QBRs, AI churn-risk alerts and upsell suggestions: new lanes, Parcel / PTL
 * mix), §11 Dept 1 and 4.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/shared/lib/utils'
import { accountStats, churnRisk, upsell } from '@shared/engines/departments'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { Customer } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const RISK_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const

export default function ERP28Accounts() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const open = data.customers[params.get('id') ?? '']
  if (open) return <Account c={open} onBack={() => setParams({})} />
  const accounts = Object.values(data.customers)
    .filter((c) => c.status === 'live')
    .sort((a, b) => b.spendMonthToDate - a.spendMonthToDate)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp28.title')} subtitle={t('erp28.subtitle', { count: accounts.length })} className="mb-0" />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="accounts">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp28.col.account')}</th>
              <th>{t('erp28.col.type')}</th>
              <th>{t('erp28.col.kam')}</th>
              <th className="text-right">{t('erp28.col.spend')}</th>
              <th className="text-right">{t('erp28.col.nps')}</th>
              <th>{t('erp28.col.churn')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((c) => {
              const risk = churnRisk(data, c.id, now)
              return (
                <tr key={c.id} className="border-b last:border-0" aria-label={c.shortName}>
                  <td className="px-4 py-2">
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setParams({ id: c.id })}>
                      {c.shortName}
                    </button>
                    <span className="block text-caption text-muted-foreground">{c.city}</span>
                  </td>
                  <td>{t(`customerType.${c.type}`)}</td>
                  <td>{c.kamId ? data.staff[c.kamId]?.name : '—'}</td>
                  <td className="tabular text-right">{formatINR(c.spendMonthToDate)}</td>
                  <td className="tabular text-right">{c.nps ?? '—'}</td>
                  <td>
                    <Chip tone={RISK_TONE[risk.level]}>{t(`erp28.risk.${risk.level}`)}</Chip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Account({ c, onBack }: { c: Customer; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const stats = accountStats(data, c.id, now)
  const risk = churnRisk(data, c.id, now)
  const ideas = upsell(data, c.id)
  const users = Object.values(data.customerUsers).filter((u) => u.customerId === c.id)
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === c.id)
  const outstanding = Object.values(data.invoices).filter((i) => i.customerId === c.id && i.status !== 'paid').reduce((s, i) => s + i.total, 0)
  const qbrs = Object.values(data.qbrs)
    .filter((q) => q.customerId === c.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const notes = Object.values(data.accountNotes)
    .filter((n) => n.customerId === c.id)
    .sort((a, b) => b.at.localeCompare(a.at))
  const [date, setDate] = useState(addDaysToDate(istDate(now), 14))
  const [agenda, setAgenda] = useState('')
  const [note, setNote] = useState('')
  const contract = c.onboarding?.contract

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('erp28.back')}
      </button>
      <PageHeader title={c.legalName} subtitle={`${t(`customerType.${c.type}`)} · ${t(`erp28.track.${c.track}`)} · ${c.kamId ? t('erp28.kamIs', { name: data.staff[c.kamId]?.name }) : t('erp28.noKam')}`} className="mb-0" />

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp28.overview')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp28.overview')}</h2>
          <p className="text-caption text-muted-foreground">{t('erp28.users', { count: users.length })}</p>
          <ul className="mb-2">
            {users.map((u) => (
              <li key={u.id}>
                {u.name} · {t(`roles.customer.${u.role}`)}
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">{t('erp28.locations', { count: locations.length })}</p>
          <ul>
            {locations.map((l) => (
              <li key={l.id}>
                {l.name} · <span className="tabular">{l.pincode}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp28.commercials')} data-testid="commercials">
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp28.commercials')}</h2>
          <p>
            {t('erp28.rateCard')}{' '}
            <Link to="/erp/pricing/rate-cards" className="text-primary hover:underline">
              {data.rateCards[c.rateCardId]?.name ?? c.rateCardId}
            </Link>
          </p>
          {c.billing === 'credit' ? <p className="tabular">{t('erp28.credit', { used: formatINR(c.creditUsed), limit: formatINR(c.creditLimit) })}</p> : <p className="tabular">{t('erp28.wallet', { amount: formatINR(c.walletBalance) })}</p>}
          <p className="tabular">{t('erp28.outstanding', { amount: formatINR(outstanding) })}</p>
          {contract && <p>{t('erp28.contract', { from: formatDate(contract.effectiveDate), months: contract.termMonths })}</p>}
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp28.health')} data-testid="health">
          <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
            {t('erp28.health')} <SimulatedTag />
          </h2>
          <p>
            {t('erp28.churn')} <Chip tone={RISK_TONE[risk.level]}>{t(`erp28.risk.${risk.level}`)}</Chip>
          </p>
          {risk.reasons.length > 0 && <p className="text-caption text-muted-foreground">{risk.reasons.map((r) => t(`erp28.why.${r}`)).join(' · ')}</p>}
          <p className="tabular">{t('erp28.npsIs', { nps: c.nps ?? '—' })}</p>
          <p className="font-medium">{t('erp28.upsell')}</p>
          <ul className="list-disc pl-5 text-table">
            {ideas.length ? ideas.map((u, i) => <li key={i}>{u.kind === 'lane' ? t('erp28.u.lane', { origin: u.origin, dest: u.dest }) : t(`erp28.u.${u.kind}`)}</li>) : <li>{t('erp28.u.none')}</li>}
          </ul>
        </section>
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card xl:grid-cols-2" aria-label={t('erp28.volume')}>
        <div>
          <h2 className="mb-1 font-heading text-section font-semibold">{t('erp28.volume')}</h2>
          <p className="text-caption text-muted-foreground">{t('erp28.onTime', { pct: stats.onTimePct ?? '—' })}</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeks.map((w) => ({ week: formatDate(w.from).slice(0, 6), count: w.count }))} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip />
                <Bar dataKey="count" name={t('erp28.shipments')} fill="var(--accent)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="account-lanes">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('erp28.col.lane')}</th>
              <th className="text-right">{t('erp28.shipments')}</th>
              <th className="text-right">{t('erp28.col.damage')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.lanes.slice(0, 8).map((l) => (
              <tr key={l.lane} className="border-b last:border-0">
                <td className="py-1">{l.lane}</td>
                <td className="tabular text-right">{l.shipments}</td>
                <td className={cn('tabular text-right', l.claims > 0 && 'text-status-danger')}>{l.damagePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp28.qbrs')}>
          <h2 className="font-heading text-section font-semibold">{t('erp28.qbrs')}</h2>
          <ul className="flex flex-col gap-1" data-testid="qbrs">
            {qbrs.map((q) => (
              <li key={q.id}>
                <span className="tabular font-medium">{formatDate(q.date)}</span> · {q.agenda}
                {q.notes && <span className="block text-caption text-muted-foreground">{q.notes}</span>}
              </li>
            ))}
            {qbrs.length === 0 && <li className="text-muted-foreground">{t('erp28.noQbrs')}</li>}
          </ul>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <Field label={t('erp28.qbrDate')} htmlFor="qbr-d">
              <Input id="qbr-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('erp28.agenda')} htmlFor="qbr-a">
              <Input id="qbr-a" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
            </Field>
            <Button
              disabled={!agenda.trim()}
              onClick={() => {
                useDemoStore.getState().scheduleQbr(c.id, date, agenda, user.id)
                setAgenda('')
                toast.success(t('erp28.qbrScheduled'))
              }}
            >
              {t('erp28.schedule')}
            </Button>
          </div>
        </section>
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp28.notes')}>
          <h2 className="font-heading text-section font-semibold">{t('erp28.notes')}</h2>
          <ul className="flex flex-col gap-1" data-testid="notes">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="text-caption text-muted-foreground">
                  {formatDateTime(n.at)} · {data.staff[n.by]?.name}
                </span>
                <span className="block">{n.text}</span>
              </li>
            ))}
            {notes.length === 0 && <li className="text-muted-foreground">{t('erp28.noNotes')}</li>}
          </ul>
          <div className="flex gap-2">
            <Input aria-label={t('erp28.note')} placeholder={t('erp28.note')} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              disabled={!note.trim()}
              onClick={() => {
                useDemoStore.getState().logAccountNote(c.id, note, user.id)
                setNote('')
              }}
            >
              {t('erp28.logNote')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
