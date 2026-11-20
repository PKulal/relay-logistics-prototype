/**
 * PP-19 Coverage: pincodes, lanes and hubs — docs/02-partner-portal.md.
 * Source §4 Step 1 (serviceable pincodes or lanes, hubs), §8 (only partners
 * registered for a leg's pincodes or lane are eligible). Changes go to Logisco
 * Network Planning (ERP-21) for approval.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

export default function PP19Coverage() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const mileLegs = partner.legs.filter((l) => l === 'firstMile' || l === 'lastMile')
  const pins = partner.coveragePincodes.map((c) => data.pincodes[c]).filter(Boolean)
  const lanes = partner.laneIds.map((id) => data.lanes[id]).filter(Boolean)
  const hubs = partner.hubIds.map((id) => data.hubs[id]).filter(Boolean)
  const requests = Object.values(data.coverageRequests)
    .filter((r) => r.partnerId === partner.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp19.title')} subtitle={t('pp19.subtitle', { pins: pins.length, lanes: lanes.length, hubs: hubs.length })} className="mb-0" />

      {pins.length > 0 && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp19.pincodes')}</h2>
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="my-pincodes">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp19.col.pincode')}</th>
                <th>{t('pp19.col.area')}</th>
                <th>{t('pp19.col.legs')}</th>
                <th>{t('pp19.col.active')}</th>
              </tr>
            </thead>
            <tbody>
              {pins.map((p) => (
                <tr key={p.code} className="border-b last:border-0" aria-label={p.code}>
                  <td className="tabular px-4 py-2">{p.code}</td>
                  <td>
                    {p.area}, {p.city}
                  </td>
                  <td>{mileLegs.map((l) => t(`legType.${l}`)).join(' · ')}</td>
                  <td>{p.serviceable ? <Chip tone="success">{t('pp19.yes')}</Chip> : <Chip tone="neutral">{t('pp19.no')}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {lanes.length > 0 && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp19.lanes')}</h2>
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="my-lanes">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp19.col.lane')}</th>
                <th>{t('pp19.col.frequency')}</th>
                <th className="text-right">{t('pp19.col.transit')}</th>
                <th className="text-right">{t('pp19.col.km')}</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((l) => (
                <tr key={l.id} className="border-b last:border-0" aria-label={`${l.originRegion} → ${l.destRegion}`}>
                  <td className="px-4 py-2">
                    {l.originRegion} → {l.destRegion}
                  </td>
                  <td>{t('pp19.daily', { time: l.departureTime })}</td>
                  <td className="tabular text-right">{t('pp19.days', { ptl: l.transitDays.expressPtl, std: l.transitDays.standardPtl })}</td>
                  <td className="tabular text-right">{l.distanceKm.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hubs.length > 0 && (
        <section className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="mb-2 font-heading text-section font-semibold">{t('pp19.hubs')}</h2>
          <ul className="flex flex-col gap-1" data-testid="my-hubs">
            {hubs.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{h.name}</span> · {h.address} · {t('pp19.docks', { count: h.docks, n: h.docks })} · {h.hours}
              </li>
            ))}
          </ul>
        </section>
      )}

      {user.role === 'admin' && <ChangeRequest />}

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp19.requests')}</h2>
        {requests.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('pp19.noRequests')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="my-requests">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp19.col.request')}</th>
                <th>{t('pp19.col.change')}</th>
                <th>{t('pp19.col.from')}</th>
                <th>{t('pp19.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b last:border-0" aria-label={r.id}>
                  <td className="tabular px-4 py-2">
                    {r.id}
                    <span className="block text-caption text-muted-foreground">{formatDateTime(r.requestedAt)}</span>
                  </td>
                  <td>
                    {t(`erp21.${r.action}`)}: {[...r.pincodes, ...r.laneIds.map((l) => `${data.lanes[l].originRegion} → ${data.lanes[l].destRegion}`)].join(', ')}
                  </td>
                  <td className="tabular">{formatDate(r.effectiveFrom)}</td>
                  <td>
                    <Chip tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{t(`erp21.status.${r.status}`)}</Chip>
                    {r.note && <span className="block text-caption text-muted-foreground">{r.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function ChangeRequest() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [action, setAction] = useState<'add' | 'remove'>('add')
  const [pins, setPins] = useState<string[]>([])
  const [laneIds, setLaneIds] = useState<string[]>([])
  const [from, setFrom] = useState(addDaysToDate(istDate(now), 7))
  const [reason, setReason] = useState('')
  const doesMile = partner.legs.some((l) => l === 'firstMile' || l === 'lastMile')
  const doesLane = partner.legs.includes('lineHaul')
  const pinOptions = Object.values(data.pincodes).filter((p) => p.serviceable && (action === 'add' ? !partner.coveragePincodes.includes(p.code) : partner.coveragePincodes.includes(p.code)))
  const laneOptions = Object.values(data.lanes).filter((l) => (action === 'add' ? !partner.laneIds.includes(l.id) : partner.laneIds.includes(l.id)))
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const submit = () => {
    const id = useDemoStore.getState().requestCoverageChange(partner.id, { action, pincodes: pins, laneIds, effectiveFrom: from, reason }, user.id)
    if (!id) return toast.error(t('cp04.fix'))
    toast.success(t('pp19.sent', { id }))
    setPins([])
    setLaneIds([])
    setReason('')
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp19.change')}>
      <h2 className="font-heading text-section font-semibold">{t('pp19.change')}</h2>
      <RadioGroup value={action} onValueChange={(v) => (setAction(v as 'add' | 'remove'), setPins([]), setLaneIds([]))} className="flex gap-4" aria-label={t('pp19.action')}>
        {(['add', 'remove'] as const).map((a) => (
          <label key={a} className="flex items-center gap-2">
            <RadioGroupItem value={a} aria-label={t(`erp21.${a}`)} /> {t(`erp21.${a}`)}
          </label>
        ))}
      </RadioGroup>
      {doesMile && (
        <fieldset>
          <legend className="mb-1 font-medium">{t('pp19.pincodes')}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('pp19.pincodes')}>
            {pinOptions.map((p) => (
              <label key={p.code} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption', pins.includes(p.code) && 'border-primary bg-primary-soft')}>
                <Checkbox aria-label={p.code} checked={pins.includes(p.code)} onCheckedChange={() => setPins(toggle(pins, p.code))} />
                <span className="tabular">{p.code}</span> {p.area}, {p.city}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {doesLane && (
        <fieldset>
          <legend className="mb-1 font-medium">{t('pp19.lanes')}</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('pp19.lanes')}>
            {laneOptions.map((l) => (
              <label key={l.id} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption', laneIds.includes(l.id) && 'border-primary bg-primary-soft')}>
                <Checkbox aria-label={`${l.originRegion} → ${l.destRegion}`} checked={laneIds.includes(l.id)} onCheckedChange={() => setLaneIds(toggle(laneIds, l.id))} />
                {l.originRegion} → {l.destRegion}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label={t('pp19.effective')} htmlFor="cr-from">
          <Input id="cr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('pp19.reason')} htmlFor="cr-reason" required>
          <Input id="cr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <Button className="self-start" disabled={(!pins.length && !laneIds.length) || !reason.trim()} onClick={submit}>
        {t('pp19.submit')}
      </Button>
    </section>
  )
}
