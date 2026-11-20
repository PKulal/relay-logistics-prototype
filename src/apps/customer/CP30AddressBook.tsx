/**
 * CP-30 Address book (saved consignees) — docs/01-customer-portal.md. Source
 * §7.2 (saved consignees). Default service is pre-selected when booking to
 * the consignee (CP-13); receiving hours guide appointment slots. Import from
 * Excel skips rows with missing fields or an unserviceable pincode.
 */
import { Download, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { serviceable } from '@shared/engines/customerSettings'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { ConsigneeInput } from '@shared/store/customerSettingsActions'
import type { Consignee, ConsigneeCategory } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { downloadTemplate, readAddressFile } from './settingsFiles'
import { useCustomerSession } from './useCustomerSession'

const CATEGORIES: ConsigneeCategory[] = ['distributor', 'retailer', 'dc', 'modernTrade', 'factory', 'otherBusiness']
const SERVICES = ['parcel', 'expressPtl', 'standardPtl'] as const

export default function CP30AddressBook() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Consignee | 'new' | null>(null)
  const [removing, setRemoving] = useState<Consignee | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const canEdit = user.role !== 'finance'
  const book = Object.values(data.consignees)
    .filter((c) => c.customerId === customer.id && c.saved !== false)
    .sort((a, b) => a.company.localeCompare(b.company))
  const shown = q.trim() ? book.filter((c) => `${c.company} ${c.contact} ${c.pincode} ${data.pincodes[c.pincode]?.city ?? ''}`.toLowerCase().includes(q.toLowerCase())) : book

  const onFile = async (f?: File) => {
    if (!f) return
    const rows = await readAddressFile(f)
    const r = useDemoStore.getState().importAddresses(customer.id, rows, user.id)
    toast.success(t('cp30.imported', { added: r.added, skipped: r.skipped }))
    if (file.current) file.current.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp30.title')}
        subtitle={t('cp30.subtitle', { count: book.length })}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadTemplate('address')}>
                <Download /> {t('cp30.template')}
              </Button>
              <Button variant="outline" onClick={() => file.current?.click()}>
                <Upload /> {t('cp30.import')}
              </Button>
              <input ref={file} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label={t('cp30.import')} onChange={(e) => void onFile(e.target.files?.[0])} />
              <Button onClick={() => setEditing('new')}>
                <Plus /> {t('cp30.add')}
              </Button>
            </div>
          )
        }
        className="mb-0"
      />
      <label className="relative block max-w-sm">
        <span className="sr-only">{t('cp30.search')}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" placeholder={t('cp30.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {shown.length === 0 ? (
        <EmptyState title={t('cp30.empty')} action={canEdit && <Button onClick={() => setEditing('new')}>{t('cp30.add')}</Button>} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="consignees">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp30.col.consignee')}</th>
                <th>{t('cp30.col.place')}</th>
                <th>{t('cp30.col.contact')}</th>
                <th>{t('cp30.col.service')}</th>
                <th>{t('cp30.col.hours')}</th>
                {canEdit && <th className="sr-only">{t('cp30.col.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b last:border-0" aria-label={c.company}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">{c.company}</span>
                    {c.appointmentRequired && <Chip tone="info">{t('cp30.appointment')}</Chip>}
                  </td>
                  <td className="text-caption">
                    {data.pincodes[c.pincode]?.city ?? '—'}, {data.pincodes[c.pincode]?.state ?? ''} · {c.pincode}
                  </td>
                  <td className="text-caption">
                    {c.contact} · {c.mobile}
                  </td>
                  <td className="text-caption">{c.defaultService ? t(`service.${c.defaultService}`) : '—'}</td>
                  <td className="text-caption">{c.receivingHours ?? '—'}</td>
                  {canEdit && (
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={t('cp30.editOne', { name: c.company })} onClick={() => setEditing(c)}>
                          <Pencil />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={t('cp30.deleteOne', { name: c.company })} onClick={() => setRemoving(c)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {editing && <AddressDialog c={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={t('cp30.deleteTitle', { name: removing?.company ?? '' })}
        body={t('cp30.deleteBody')}
        confirmLabel={t('cp30.delete')}
        destructive
        onConfirm={() => {
          if (removing) {
            useDemoStore.getState().removeAddress(removing.id, user.id)
            toast.success(t('cp30.deleted', { name: removing.company }))
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}

function AddressDialog({ c, onClose }: { c?: Consignee; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const blank: ConsigneeInput = { type: 'business', category: 'distributor', company: '', contact: '', mobile: '', address: '', pincode: '', appointmentRequired: false }
  const [f, setF] = useState<ConsigneeInput>(c ? { ...c } : blank)
  const [err, setErr] = useState('')
  const set = (patch: Partial<ConsigneeInput>) => setF((x) => ({ ...x, ...patch }))
  const pinOk = f.pincode.length === 6 && serviceable(data, f.pincode)

  const save = () => {
    const r = useDemoStore.getState().saveAddress(customer.id, f, c?.id, user.id)
    if (r.error) return setErr(t(`cp30.err.${r.error}`))
    toast.success(t('cp30.saved', { name: f.company }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{c ? t('cp30.editOne', { name: c.company }) : t('cp30.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('cp30.f.company')} htmlFor="c-company" required>
            <Input id="c-company" value={f.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.category')} htmlFor="c-cat">
            <NativeSelect id="c-cat" value={f.category} onChange={(e) => set({ category: e.target.value as ConsigneeCategory, appointmentRequired: e.target.value === 'dc' || e.target.value === 'modernTrade' || f.appointmentRequired })}>
              {CATEGORIES.map((x) => (
                <option key={x} value={x}>
                  {t(`cp13.categories.${x}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp30.f.contact')} htmlFor="c-contact" required>
            <Input id="c-contact" value={f.contact} onChange={(e) => set({ contact: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.mobile')} htmlFor="c-mobile" required>
            <Input id="c-mobile" inputMode="tel" value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.address')} htmlFor="c-address" required className="sm:col-span-2">
            <Input id="c-address" value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.landmark')} htmlFor="c-landmark">
            <Input id="c-landmark" value={f.landmark ?? ''} onChange={(e) => set({ landmark: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.pincode')} htmlFor="c-pin" required hint={f.pincode.length === 6 && (pinOk ? `${data.pincodes[f.pincode].city}, ${data.pincodes[f.pincode].state}` : t('cp29.notServiceable'))}>
            <Input id="c-pin" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label={t('cp30.f.gstin')} htmlFor="c-gstin">
            <Input id="c-gstin" value={f.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={t('cp30.f.email')} htmlFor="c-email">
            <Input id="c-email" type="email" value={f.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label={t('cp30.f.service')} htmlFor="c-service">
            <NativeSelect id="c-service" value={f.defaultService ?? ''} onChange={(e) => set({ defaultService: (e.target.value || undefined) as ConsigneeInput['defaultService'] })}>
              <option value="">{t('cp30.noDefault')}</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {t(`service.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp30.f.hours')} htmlFor="c-hours" hint={t('cp30.hoursHint')}>
            <Input id="c-hours" value={f.receivingHours ?? ''} onChange={(e) => set({ receivingHours: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <Checkbox checked={f.appointmentRequired} onCheckedChange={(v) => set({ appointmentRequired: !!v })} /> {t('cp30.f.appointment')}
          </label>
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
