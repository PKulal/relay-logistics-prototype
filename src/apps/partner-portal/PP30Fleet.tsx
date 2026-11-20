/**
 * PP-30 Vehicles — docs/02-partner-portal.md. Source §4 Step 3, §4.1 (RC,
 * fitness, permit, insurance), §13 (ULIP Vahan, FASTag, GPS). Registration is
 * verified on Vahan (SIMULATED), which also fills the document expiries. A
 * vehicle with an expired document can't be assigned (PP-14). Bulk upload is
 * not built (no basis in the client document).
 */
import { CheckCircle2, Pencil, Plus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { vahanCheck } from '@shared/engines/partnerOnboarding'
import { VEHICLE_DOCS, vehicleBlock, vehicleExpiry, type VehicleDoc } from '@shared/engines/partnerSettings'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { VehicleInput } from '@shared/store/partnerSettingsActions'
import type { Vehicle } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { usePartnerSession } from './usePartnerSession'

const TYPES = ['Two-wheeler', 'Three-wheeler', 'Tempo', '14–17 ft', '19–24 ft', '32 ft']

export default function PP30Fleet() {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)
  const vehicles = Object.values(data.vehicles)
    .filter((v) => v.partnerId === partner.id)
    .sort((a, b) => a.regNo.localeCompare(b.regNo))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp30.title')}
        subtitle={t('pp30.subtitle', { count: vehicles.length })}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('pp30.add')}
          </Button>
        }
        className="mb-0"
      />
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="vehicles">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('pp30.col.reg')}</th>
              <th>{t('pp30.col.type')}</th>
              <th>{t('pp30.col.payload')}</th>
              <th>{t('pp30.col.docs')}</th>
              <th>{t('pp30.col.tracking')}</th>
              <th>{t('pp30.col.status')}</th>
              <th className="sr-only">{t('pp30.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const block = vehicleBlock(v, now)
              return (
                <tr key={v.id} className="border-b align-top last:border-0" aria-label={v.regNo}>
                  <td className="tabular px-4 py-2 font-medium whitespace-nowrap">
                    {v.regNo}
                    <span className="block text-caption font-normal text-muted-foreground">{t(`pp30.own.${v.ownership ?? 'own'}`)}</span>
                  </td>
                  <td className="py-2">{v.type}</td>
                  <td className="tabular whitespace-nowrap">{v.payloadKg.toLocaleString('en-IN')} kg</td>
                  <td className="text-caption">
                    {v.docs
                      ? VEHICLE_DOCS.map((k) => (
                          <span key={k} className={v.docs![k] < now.slice(0, 10) ? 'block font-medium text-status-danger' : 'block'}>
                            {t(`pp30.doc.${k}`)} {formatDate(v.docs![k])}
                          </span>
                        ))
                      : t('pp30.docsTill', { date: formatDate(vehicleExpiry(v)) })}
                  </td>
                  <td className="text-caption">
                    {v.fastagId ? `FASTag ${v.fastagId}` : '—'}
                    {v.gpsId && <span className="block">GPS {v.gpsId}</span>}
                  </td>
                  <td className="py-2">
                    <Chip tone={!block ? 'success' : block === 'inactive' ? 'neutral' : 'danger'}>{t(`pp30.state.${block ?? 'ok'}`)}</Chip>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={v.active !== false}
                        aria-label={t('pp30.activeToggle', { reg: v.regNo })}
                        onCheckedChange={(on) => (useDemoStore.getState().setVehicleActive(v.id, on, user.id), toast.success(t(on ? 'pp30.activated' : 'pp30.deactivated', { reg: v.regNo })))}
                      />
                      <Button size="sm" variant="ghost" aria-label={t('pp30.editOne', { reg: v.regNo })} onClick={() => setEditing(v)}>
                        <Pencil />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <p className="text-caption text-muted-foreground">{t('pp30.rule')}</p>
      {editing && <VehicleDialog v={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function VehicleDialog({ v, onClose }: { v?: Vehicle; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const [f, setF] = useState<VehicleInput>({
    regNo: v?.regNo ?? '',
    type: v?.type ?? 'Tempo',
    payloadKg: v?.payloadKg ?? 0,
    docs: v?.docs ?? { rc: '', fitness: '', permit: '', insurance: '' },
    fastagId: v?.fastagId ?? '',
    gpsId: v?.gpsId ?? '',
    ownership: v?.ownership ?? 'own',
  })
  const [vahan, setVahan] = useState<{ ok: boolean; reason?: string }>()
  const [err, setErr] = useState('')
  const types = TYPES.includes(f.type) ? TYPES : [f.type, ...TYPES]
  const set = (patch: Partial<VehicleInput>) => setF((x) => ({ ...x, ...patch }))

  const verify = () => {
    const r = vahanCheck(data, f.regNo, partner.id)
    setVahan({ ok: r.ok, reason: r.detail.reason })
    if (r.ok) set({ regNo: r.detail.reg, docs: { ...f.docs, fitness: r.detail.fitnessTill, permit: r.detail.permitTill, insurance: r.detail.insuranceTill } })
  }
  const save = () => {
    const r = useDemoStore.getState().saveVehicle(partner.id, { ...f, payloadKg: Number(f.payloadKg) }, v?.id, user.id)
    if (r.error) return setErr(t(`pp30.err.${r.error}`))
    toast.success(t('pp30.saved', { reg: f.regNo.toUpperCase() }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{v ? t('pp30.editOne', { reg: v.regNo }) : t('pp30.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('pp30.f.reg')}
            htmlFor="v-reg"
            required
            className="sm:col-span-2"
            hint={
              vahan &&
              (vahan.ok ? (
                <span className="flex items-center gap-1 text-status-success">
                  <CheckCircle2 className="size-3.5" aria-hidden /> {t('pp30.vahanOk')} <SimulatedTag />
                </span>
              ) : (
                <span className="flex items-center gap-1 text-status-danger">
                  <XCircle className="size-3.5" aria-hidden /> {t(`pp30.err.${vahan.reason === 'duplicate' ? 'duplicate' : 'vahan'}`)}
                </span>
              ))
            }
          >
            <div className="flex gap-2">
              <Input id="v-reg" value={f.regNo} placeholder="KA25AB1234" onChange={(e) => (set({ regNo: e.target.value.toUpperCase() }), setVahan(undefined))} />
              <Button type="button" variant="outline" disabled={!f.regNo.trim()} onClick={verify}>
                {t('pp30.verify')}
              </Button>
            </div>
          </Field>
          <Field label={t('pp30.f.type')} htmlFor="v-type" required>
            <NativeSelect id="v-type" value={f.type} onChange={(e) => set({ type: e.target.value })}>
              {types.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('pp30.f.payload')} htmlFor="v-payload" required>
            <Input id="v-payload" inputMode="numeric" value={f.payloadKg || ''} onChange={(e) => set({ payloadKg: Number(e.target.value.replace(/\D/g, '')) })} />
          </Field>
          {VEHICLE_DOCS.map((k: VehicleDoc) => (
            <Field key={k} label={t(`pp30.f.${k}`)} htmlFor={`v-${k}`} required>
              <Input id={`v-${k}`} type="date" value={f.docs[k]} onChange={(e) => set({ docs: { ...f.docs, [k]: e.target.value } })} />
            </Field>
          ))}
          <Field label={t('pp30.f.fastag')} htmlFor="v-fastag" hint={t('pp30.fastagHint')}>
            <Input id="v-fastag" value={f.fastagId} onChange={(e) => set({ fastagId: e.target.value })} />
          </Field>
          <Field label={t('pp30.f.gps')} htmlFor="v-gps">
            <Input id="v-gps" value={f.gpsId} onChange={(e) => set({ gpsId: e.target.value })} />
          </Field>
          <fieldset className="flex items-center gap-4 sm:col-span-2">
            <legend className="mb-1 text-caption font-medium">{t('pp30.f.ownership')}</legend>
            {(['own', 'attached'] as const).map((o) => (
              <label key={o} className="flex items-center gap-2">
                <input type="radio" name="v-own" checked={f.ownership === o} onChange={() => set({ ownership: o })} className="accent-[var(--accent)]" /> {t(`pp30.own.${o}`)}
              </label>
            ))}
          </fieldset>
        </div>
        {err && (
          <p role="alert" className="text-caption text-status-danger">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
