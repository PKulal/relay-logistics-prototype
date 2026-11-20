/**
 * ERP-18 Pincode and ODA master — docs/04-erp-control-tower.md. Source §11
 * Dept 6 (pincode / ODA master), §8 (only partners registered for a pincode are
 * eligible). Parcel zones come from the origin–destination pair, so the master
 * shows the metro and special-area flags that decide them. Bulk Excel upload is
 * not in the client document.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { pincodeCoverage } from '@shared/engines/network'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { NewPincode } from '@shared/store/networkActions'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { useErpSession } from './useErpSession'

const EDIT_ROLES = ['networkPlanning', 'superAdmin']

export default function ERP18Pincodes() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const canEdit = EDIT_ROLES.includes(user.role)
  const cov = pincodeCoverage(data)
  const name = (id: string) => data.partners[id].shortName
  const rows = Object.values(data.pincodes)
    .filter((p) => !q.trim() || `${p.code} ${p.area} ${p.city} ${p.state}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city) || a.code.localeCompare(b.code))
  const edit = (code: string, e: { oda?: boolean; serviceable?: boolean }) => {
    useDemoStore.getState().updatePincode(code, e, user.id)
    toast.success(t('erp18.saved', { code }))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp18.title')}
        subtitle={t('erp18.subtitle', { count: Object.keys(data.pincodes).length })}
        actions={canEdit && <Button onClick={() => setAdding(!adding)}>{t('erp18.add')}</Button>}
        className="mb-0"
      />
      {adding && <AddPincode onDone={() => setAdding(false)} />}
      <Input aria-label={t('erp18.search')} placeholder={t('erp18.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="pincodes">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp18.col.pincode')}</th>
              <th>{t('erp18.col.place')}</th>
              <th>{t('erp18.col.hub')}</th>
              <th>{t('erp18.col.flags')}</th>
              <th>{t('erp18.col.oda')}</th>
              <th>{t('erp18.col.serviceable')}</th>
              <th>{t('erp18.col.partners')}</th>
              <th>{t('erp18.col.risk')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = cov[p.code]
              const risk = p.serviceable ? (['firstMile', 'lastMile'] as const).find((k) => c[k].length < 2) : undefined
              return (
                <tr key={p.code} className={cn('border-b last:border-0', !p.serviceable && 'text-muted-foreground')} aria-label={p.code}>
                  <td className="tabular px-4 py-2 font-medium">{p.code}</td>
                  <td>
                    {p.area} · {p.city}
                    <span className="block text-caption text-muted-foreground">{p.state}</span>
                  </td>
                  <td>{p.hubId ? data.hubs[p.hubId]?.name : '—'}</td>
                  <td className="text-caption">
                    {p.metro && <Chip tone="neutral">{t('erp18.metro')}</Chip>} {p.special && <Chip tone="warning">{t('erp18.special')}</Chip>}
                  </td>
                  <td>
                    <Switch aria-label={t('erp18.odaX', { code: p.code })} checked={p.oda} disabled={!canEdit} onCheckedChange={(v) => edit(p.code, { oda: v })} />
                  </td>
                  <td>
                    <Switch aria-label={t('erp18.serviceableX', { code: p.code })} checked={p.serviceable} disabled={!canEdit} onCheckedChange={(v) => edit(p.code, { serviceable: v })} />
                  </td>
                  <td className="text-caption" title={`${c.firstMile.map(name).join(', ')} / ${c.lastMile.map(name).join(', ')}`}>
                    <span className="tabular font-medium">
                      {c.firstMile.length} / {c.lastMile.length}
                    </span>
                    <span className="block text-muted-foreground">{[...new Set([...c.firstMile, ...c.lastMile])].map(name).join(', ') || '—'}</span>
                  </td>
                  <td>{risk && <Chip tone={c[risk].length ? 'warning' : 'danger'}>{t(c[risk].length ? 'erp18.single' : 'erp18.none', { leg: t(`legType.${risk}`) })}</Chip>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AddPincode({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [x, setX] = useState<NewPincode>({ code: '', area: '', city: '', state: '', region: '', hubId: '', oda: false, metro: false })
  const set = (k: keyof NewPincode, v: string | boolean) => setX({ ...x, [k]: v })
  const ok = /^\d{6}$/.test(x.code) && !data.pincodes[x.code] && x.area.trim() && x.city.trim() && x.state.trim() && x.hubId
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp18.add')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('erp18.col.pincode')} htmlFor="np-code" required error={x.code && data.pincodes[x.code] ? t('erp18.exists') : undefined}>
          <Input id="np-code" inputMode="numeric" maxLength={6} className="tabular" value={x.code} onChange={(e) => set('code', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={t('erp18.area')} htmlFor="np-area" required>
          <Input id="np-area" value={x.area} onChange={(e) => set('area', e.target.value)} />
        </Field>
        <Field label={t('erp18.city')} htmlFor="np-city" required>
          <Input id="np-city" value={x.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label={t('erp18.state')} htmlFor="np-state" required>
          <Input id="np-state" value={x.state} onChange={(e) => set('state', e.target.value)} />
        </Field>
        <Field label={t('erp18.col.hub')} htmlFor="np-hub" required>
          <NativeSelect
            id="np-hub"
            value={x.hubId}
            onChange={(e) => {
              const hub = data.hubs[e.target.value]
              setX({ ...x, hubId: e.target.value, region: hub ? data.pincodes[hub.pincode].region : '' })
            }}
          >
            <option value="">{t('cp04.choose')}</option>
            {Object.values(data.hubs).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2">
            <Switch checked={x.oda} onCheckedChange={(v) => set('oda', v)} aria-label={t('erp18.col.oda')} /> {t('erp18.col.oda')}
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={x.metro} onCheckedChange={(v) => set('metro', v)} aria-label={t('erp18.metro')} /> {t('erp18.metro')}
          </label>
        </div>
      </div>
      <Button
        className="self-start"
        disabled={!ok}
        onClick={() => {
          useDemoStore.getState().addPincode(x, user.id)
          toast.success(t('erp18.added', { code: x.code }))
          onDone()
        }}
      >
        {t('erp18.save')}
      </Button>
    </section>
  )
}
