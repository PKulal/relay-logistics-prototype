/**
 * PP-31 Hubs — docs/02-partner-portal.md. Source §3 (Type F hub operators),
 * §4 Step 4 (hub audit), §4.1 (hub lease, fire NOC, trade licence). Adding a
 * hub triggers a new audit (Logisco hub auditor is notified).
 */
import { Pencil, Plus, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { HubInput } from '@shared/store/partnerSettingsActions'
import type { Hub } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

const AUDIT_TONE = { pending: 'warning', passed: 'success', failed: 'danger' } as const
const DATES = ['scaleCalibrationTill', 'fireNocTill', 'tradeLicenceTill', 'leaseTill'] as const

export default function PP31Hubs() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const [editing, setEditing] = useState<Hub | 'new' | null>(null)
  const hubs = Object.values(data.hubs).filter((h) => h.partnerId === partner.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp31.title')}
        subtitle={t('pp31.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('pp31.add')}
          </Button>
        }
        className="mb-0"
      />
      {hubs.length === 0 ? (
        <EmptyState icon={Warehouse} title={t('pp31.empty')} action={<Button onClick={() => setEditing('new')}>{t('pp31.add')}</Button>} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="hubs">
          {hubs.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={h.name}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading font-semibold">{h.name}</h2>
                  <p className="text-caption text-muted-foreground">
                    {h.address} · {h.pincode}
                  </p>
                </div>
                <Chip tone={AUDIT_TONE[h.auditStatus]}>{t(`pp31.audit.${h.auditStatus}`)}</Chip>
              </div>
              <p className="text-caption">
                {t('pp31.facts', { docks: h.docks, hours: h.hours, area: (h.areaSqft ?? 0).toLocaleString('en-IN'), pallets: h.storagePallets ?? '—' })}
              </p>
              <ul className="grid grid-cols-2 gap-x-4 text-caption text-muted-foreground">
                {DATES.filter((k) => h[k]).map((k) => (
                  <li key={k}>
                    {t(`pp31.f.${k}`)}: <span className="tabular text-foreground">{formatDate(h[k]!)}</span>
                  </li>
                ))}
                <li>
                  {t('pp31.safety')}: {h.cctv ? '✓' : '✗'} / {h.fireSafety ? '✓' : '✗'}
                </li>
              </ul>
              <Button size="sm" variant="ghost" className="self-start" onClick={() => setEditing(h)}>
                <Pencil /> {t('pp31.edit')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <HubDialog hub={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function HubDialog({ hub, onClose }: { hub?: Hub; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const [f, setF] = useState<HubInput>({
    name: hub?.name ?? '',
    address: hub?.address ?? '',
    pincode: hub?.pincode ?? '',
    docks: hub?.docks ?? 0,
    hours: hub?.hours ?? '24×7',
    areaSqft: hub?.areaSqft,
    storagePallets: hub?.storagePallets,
    scaleCalibrationTill: hub?.scaleCalibrationTill,
    fireNocTill: hub?.fireNocTill,
    tradeLicenceTill: hub?.tradeLicenceTill,
    leaseTill: hub?.leaseTill,
    cctv: hub?.cctv ?? false,
    fireSafety: hub?.fireSafety ?? false,
  })
  const [err, setErr] = useState('')
  const set = (patch: Partial<HubInput>) => setF((x) => ({ ...x, ...patch }))
  const num = (v: string) => (v ? Number(v.replace(/\D/g, '')) : undefined)

  const save = () => {
    const r = useDemoStore.getState().saveHub(partner.id, f, hub?.id, user.id)
    if (r.error) return setErr(t(`pp31.err.${r.error}`))
    toast.success(hub ? t('pp31.saved', { name: f.name }) : t('pp31.added', { name: f.name }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{hub ? t('pp31.editTitle', { name: hub.name }) : t('pp31.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pp31.f.name')} htmlFor="h-name" required>
            <Input id="h-name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t('pp31.f.pincode')} htmlFor="h-pin" required>
            <Input id="h-pin" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label={t('pp31.f.address')} htmlFor="h-address" required className="sm:col-span-2">
            <Input id="h-address" value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label={t('pp31.f.area')} htmlFor="h-area" required>
            <Input id="h-area" inputMode="numeric" value={f.areaSqft ?? ''} onChange={(e) => set({ areaSqft: num(e.target.value) })} />
          </Field>
          <Field label={t('pp31.f.docks')} htmlFor="h-docks" required>
            <Input id="h-docks" inputMode="numeric" value={f.docks || ''} onChange={(e) => set({ docks: num(e.target.value) ?? 0 })} />
          </Field>
          <Field label={t('pp31.f.hours')} htmlFor="h-hours" required>
            <Input id="h-hours" value={f.hours} onChange={(e) => set({ hours: e.target.value })} />
          </Field>
          <Field label={t('pp31.f.storage')} htmlFor="h-storage">
            <Input id="h-storage" inputMode="numeric" value={f.storagePallets ?? ''} onChange={(e) => set({ storagePallets: num(e.target.value) })} />
          </Field>
          {DATES.map((k) => (
            <Field key={k} label={t(`pp31.f.${k}`)} htmlFor={`h-${k}`} required={k === 'scaleCalibrationTill'}>
              <Input id={`h-${k}`} type="date" value={f[k] ?? ''} onChange={(e) => set({ [k]: e.target.value || undefined })} />
            </Field>
          ))}
          <label className="flex items-center gap-2">
            <Checkbox checked={!!f.cctv} onCheckedChange={(v) => set({ cctv: !!v })} /> {t('pp31.f.cctv')}
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={!!f.fireSafety} onCheckedChange={(v) => set({ fireSafety: !!v })} /> {t('pp31.f.fire')}
          </label>
        </div>
        {!hub && <p className="text-caption text-muted-foreground">{t('pp31.auditNote')}</p>}
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
