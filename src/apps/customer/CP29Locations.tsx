/**
 * CP-29 Pickup locations — docs/01-customer-portal.md. Source §6 Step 3
 * (pickup addresses), §7.2. Admin edits; Dispatch views. A new pincode is
 * checked for serviceability before it can be saved; inactive locations can't
 * be booked from (CP-13). Recurring pickup is not built (no basis in the
 * client document).
 */
import { CheckCircle2, MapPin, Pencil, Plus, Star, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { locationActive, serviceable } from '@shared/engines/customerSettings'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { LocationInput } from '@shared/store/customerSettingsActions'
import type { PickupLocation } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { useCustomerSession } from './useCustomerSession'

export default function CP29Locations() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const isAdmin = user.role === 'admin'
  const locations = Object.values(data.pickupLocations)
    .filter((l) => l.customerId === customer.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
  const [editing, setEditing] = useState<PickupLocation | 'new' | null>(null)
  const store = useDemoStore.getState

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp29.title')}
        subtitle={isAdmin ? t('cp29.subtitle') : t('cp29.viewOnly')}
        actions={
          isAdmin && (
            <Button onClick={() => setEditing('new')}>
              <Plus /> {t('cp29.add')}
            </Button>
          )
        }
        className="mb-0"
      />
      <ul className="grid gap-3 lg:grid-cols-2" data-testid="locations">
        {locations.map((l) => {
          const active = locationActive(l)
          return (
            <li key={l.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={l.name}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-heading font-semibold">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden /> {l.name}
                  </h2>
                  <p className="text-caption text-muted-foreground">
                    {l.address} · {l.pincode} {data.pincodes[l.pincode]?.city}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {l.isDefault && <Chip tone="info">{t('cp29.default')}</Chip>}
                  <Chip tone={active ? 'success' : 'neutral'}>{t(active ? 'cp29.active' : 'cp29.inactive')}</Chip>
                </div>
              </div>
              <p className="text-caption">
                {t('cp29.window', { days: l.days, from: l.window.from, to: l.window.to })} · {l.contact.name} ({l.contact.mobile})
              </p>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-3 border-t pt-2">
                  <label className="flex items-center gap-2 text-caption">
                    <Switch
                      checked={active}
                      disabled={l.isDefault}
                      aria-label={t('cp29.activeToggle', { name: l.name })}
                      onCheckedChange={(v) => (store().setLocationActive(l.id, v, user.id), toast.success(t(v ? 'cp29.activated' : 'cp29.deactivated', { name: l.name })))}
                    />
                    {t('cp29.active')}
                  </label>
                  {!l.isDefault && active && (
                    <Button size="sm" variant="outline" onClick={() => (store().setDefaultLocation(l.id, user.id), toast.success(t('cp29.defaultSet', { name: l.name })))}>
                      <Star /> {t('cp29.setDefault')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                    <Pencil /> {t('cp29.edit')}
                  </Button>
                  {l.isDefault && <span className="text-caption text-muted-foreground">{t('cp29.defaultNote')}</span>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {editing && <LocationDialog loc={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function LocationDialog({ loc, onClose }: { loc?: PickupLocation; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const [f, setF] = useState<LocationInput>(loc ? { name: loc.name, address: loc.address, pincode: loc.pincode, contact: loc.contact, window: loc.window, days: loc.days } : { name: '', address: '', pincode: '', contact: { name: '', mobile: '' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
  const [err, setErr] = useState('')
  const pin = f.pincode.trim().length === 6 ? data.pincodes[f.pincode.trim()] : undefined
  const ok = f.pincode.trim().length === 6 && serviceable(data, f.pincode)

  const save = () => {
    const r = useDemoStore.getState().upsertPickupLocation(customer.id, f, loc?.id, user.id)
    if (r.error) return setErr(t(`cp29.err.${r.error}`))
    toast.success(t('cp29.saved', { name: f.name }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{loc ? t('cp29.editTitle', { name: loc.name }) : t('cp29.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('cp29.f.name')} htmlFor="l-name" required className="sm:col-span-2">
            <Input id="l-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('cp29.f.address')} htmlFor="l-address" required className="sm:col-span-2">
            <Input id="l-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field
            label={t('cp29.f.pincode')}
            htmlFor="l-pin"
            required
            hint={
              f.pincode.trim().length === 6 &&
              (ok ? (
                <span className="flex items-center gap-1 text-status-success">
                  <CheckCircle2 className="size-3.5" aria-hidden /> {t('cp29.serviceable', { city: pin?.city, area: pin?.area })}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-status-danger">
                  <XCircle className="size-3.5" aria-hidden /> {t('cp29.notServiceable')}
                </span>
              ))
            }
          >
            <Input id="l-pin" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label={t('cp29.f.days')} htmlFor="l-days">
            <Input id="l-days" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
          </Field>
          <Field label={t('cp29.f.from')} htmlFor="l-from" required>
            <Input id="l-from" type="time" value={f.window.from} onChange={(e) => setF({ ...f, window: { ...f.window, from: e.target.value } })} />
          </Field>
          <Field label={t('cp29.f.to')} htmlFor="l-to" required>
            <Input id="l-to" type="time" value={f.window.to} onChange={(e) => setF({ ...f, window: { ...f.window, to: e.target.value } })} />
          </Field>
          <Field label={t('cp29.f.contact')} htmlFor="l-contact" required>
            <Input id="l-contact" value={f.contact.name} onChange={(e) => setF({ ...f, contact: { ...f.contact, name: e.target.value } })} />
          </Field>
          <Field label={t('cp29.f.mobile')} htmlFor="l-mobile" required>
            <Input id="l-mobile" inputMode="tel" value={f.contact.mobile} onChange={(e) => setF({ ...f, contact: { ...f.contact, mobile: e.target.value } })} />
          </Field>
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
          <Button onClick={save} disabled={!ok}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
