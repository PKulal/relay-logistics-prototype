/**
 * ERP-11 Partner applications — docs/04-erp-control-tower.md.
 * Source §4 Phase 1 Step 2 and §12 (Network-Gap Fit Score): every application
 * with its AI fit score; invite (coordinator assigned, onboarding pack sent),
 * waitlist (re-scored monthly) or reject with a reason. Target: same day.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { CAPACITY_UNIT, FIT_INVITE, RATE_UNIT } from '@shared/engines/partnerOnboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { PartnerApplication } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { AppStatusChip, useFitText } from '@shared/ui/PartnerOnboardingBits'
import { useErpSession } from './useErpSession'

const FILTERS = ['open', 'all', 'new', 'invited', 'waitlisted', 'rejected'] as const
type Filter = (typeof FILTERS)[number]

export default function ERP11Applications() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const fitText = useFitText()
  const [filter, setFilter] = useState<Filter>('open')
  const [selected, setSelected] = useState<string>()
  const all = Object.values(data.applications).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  const shown = all.filter((a) => (filter === 'all' ? true : filter === 'open' ? a.status === 'new' || a.status === 'waitlisted' : filter === 'invited' ? !['new', 'waitlisted', 'rejected'].includes(a.status) : a.status === filter))
  const current = selected ? data.applications[selected] : undefined

  const coverage = (a: PartnerApplication) =>
    a.lanes.length ? a.lanes.map((l) => `${l.origin} → ${l.dest}`).join(', ') : a.pincodes.length ? t('erp11.pincodes', { count: a.pincodes.length, cities: a.cities.join(', ') }) : a.hubs.map((h) => `${h.name} (${h.pincode})`).join(', ')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp11.title')} subtitle={t('erp11.subtitle', { count: all.filter((a) => a.status === 'new').length })} className="mb-0" />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('erp11.filter')}>
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`erp11.f.${f}`)}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table" data-testid="applications">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp11.col.application')}</th>
              <th>{t('erp11.col.partner')}</th>
              <th>{t('erp11.col.coverage')}</th>
              <th>{t('erp11.col.fit')}</th>
              <th>{t('erp11.col.status')}</th>
              <th className="pr-4">{t('erp11.col.received')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  {t('erp11.empty')}
                </td>
              </tr>
            )}
            {shown.map((a) => {
              const p = data.partners[a.partnerId]
              return (
                <tr key={a.id} className={cn('border-b align-top last:border-0', selected === a.id && 'bg-primary-soft')}>
                  <td className="px-4 py-2">
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSelected(a.id)}>
                      {a.ref}
                    </button>
                  </td>
                  <td className="py-2">
                    {p.name}
                    <span className="block text-caption text-muted-foreground">
                      {t('partner.typeShort', { type: p.type })} · {p.legs.map((l) => t(`legType.${l}`)).join(', ')}
                    </span>
                  </td>
                  <td className="max-w-64 py-2">{coverage(a)}</td>
                  <td className="max-w-72 py-2">
                    <span className={cn('tabular font-semibold', a.fitScore >= FIT_INVITE ? 'text-status-success' : 'text-status-warning')}>{a.fitScore}</span>
                    <span className="block text-caption text-muted-foreground">{fitText(a)}</span>
                  </td>
                  <td className="py-2">
                    <AppStatusChip status={a.status} />
                  </td>
                  <td className="tabular py-2 pr-4">{formatDateTime(a.receivedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {current && <Detail key={current.id} app={current} />}
    </div>
  )
}

function Detail({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const p = data.partners[app.partnerId]
  const managers = Object.values(data.staff).filter((s) => s.role === 'partnerManagement')
  const [coordinator, setCoordinator] = useState(p.coordinatorId ?? managers[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const canDecide = user.role === 'partnerManagement' && (app.status === 'new' || app.status === 'waitlisted')
  const decide = (d: 'invite' | 'waitlist' | 'reject') => {
    if (d === 'reject' && !reason.trim()) return setTried(true)
    useDemoStore.getState().decideFit(app.id, d, { coordinatorId: coordinator, reason }, user.id)
    toast.success(t(`erp11.done.${d}`, { name: p.shortName }))
  }

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card lg:grid-cols-2" aria-label={app.ref}>
      <div className="flex flex-col gap-2">
        <h2 className="text-card-title">
          {p.name} · {app.ref}
        </h2>
        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-table">
          <dt className="text-muted-foreground">{t('erp11.d.contact')}</dt>
          <dd>
            {app.contact.name}
            {app.contact.designation && `, ${app.contact.designation}`} · {app.contact.mobile} · {app.contact.email}
          </dd>
          <dt className="text-muted-foreground">{t('erp11.d.ids')}</dt>
          <dd className="tabular">
            {p.gstin || t('erp11.d.noGst')} · {p.pan} · {t(`ponb.constitution.${app.constitution}`)}
          </dd>
          <dt className="text-muted-foreground">{t('erp11.d.source')}</dt>
          <dd>{t(`ponb.source.${app.source}`)}</dd>
          <dt className="text-muted-foreground">{t('erp11.d.services')}</dt>
          <dd>{app.services.map((s) => t(`service.${s}`)).join(', ')}</dd>
          <dt className="text-muted-foreground">{t('erp11.d.area')}</dt>
          <dd>
            {app.states.join(', ')} · {app.cities.join(', ')}
          </dd>
          {app.lanes.length > 0 && (
            <>
              <dt className="text-muted-foreground">{t('erp11.d.lanes')}</dt>
              <dd>{app.lanes.map((l) => `${l.origin} → ${l.dest} (${t(`ponb.freq.${l.frequency}`)}, ${l.transitHours} h)`).join('; ')}</dd>
            </>
          )}
          {app.pincodes.length > 0 && (
            <>
              <dt className="text-muted-foreground">{t('erp11.d.pincodes')}</dt>
              <dd className="tabular">{app.pincodes.join(', ')}</dd>
            </>
          )}
          {app.hubs.length > 0 && (
            <>
              <dt className="text-muted-foreground">{t('erp11.d.hubs')}</dt>
              <dd>{app.hubs.map((h) => t('erp11.d.hub', { name: h.name, pincode: h.pincode, area: h.areaSqft.toLocaleString('en-IN'), docks: h.docks })).join('; ')}</dd>
            </>
          )}
          {Object.keys(app.fleet).length > 0 && (
            <>
              <dt className="text-muted-foreground">{t('erp11.d.fleet')}</dt>
              <dd>{Object.entries(app.fleet).map(([k, n]) => `${t(`ponb.vehicle.${k}`)} ${n}`).join(', ')}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('erp11.d.capacity')}</dt>
          <dd className="tabular">
            {app.capacity.toLocaleString('en-IN')} {t(`ponb.capUnit.${CAPACITY_UNIT[p.type]}`)}
          </dd>
          <dt className="text-muted-foreground">{t('erp11.d.rates')}</dt>
          <dd className="tabular">{app.indicativeRates.map((r) => `${t(`legType.${r.leg}`)} ${formatINR(r.rate)} ${t(`ponb.rateUnit.${RATE_UNIT[p.type]}`)}`).join('; ')}</dd>
        </dl>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="font-semibold">{t('erp11.fitScore', { score: app.fitScore })}</p>
          <p className="text-caption text-muted-foreground">{t('erp11.fitRule', { min: FIT_INVITE })}</p>
        </div>
        {app.decision && (
          <p className="text-caption text-muted-foreground">
            {t('erp11.decidedBy', { name: app.decision.by === 'system' ? t('erp11.system') : (data.staff[app.decision.by]?.name ?? app.decision.by), at: formatDateTime(app.decision.at) })}
            {app.decision.reason && ` · ${app.decision.reason}`}
            {app.rescoreOn && ` · ${t('erp11.rescoreOn', { date: formatDate(app.rescoreOn) })}`}
          </p>
        )}
        {canDecide ? (
          <>
            <Field label={t('erp11.coordinator')} htmlFor="e11-co">
              <NativeSelect id="e11-co" value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('erp11.reason')} htmlFor="e11-r" error={tried && !reason.trim() ? t('erp11.reasonRequired') : undefined}>
              <Input id="e11-r" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => decide('invite')}>{t('erp11.invite')}</Button>
              {app.status !== 'waitlisted' && (
                <Button variant="outline" onClick={() => decide('waitlist')}>
                  {t('erp11.waitlist')}
                </Button>
              )}
              <Button variant="destructive" onClick={() => decide('reject')}>
                {t('erp11.reject')}
              </Button>
            </div>
          </>
        ) : (
          app.kycSubmittedAt && (
            <Link to={`/erp/partners/kyc?app=${app.id}`} className="font-medium text-primary hover:underline">
              {t('erp11.openKyc')}
            </Link>
          )
        )}
      </div>
    </section>
  )
}
