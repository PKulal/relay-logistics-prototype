/**
 * PP-29 Field staff — docs/02-partner-portal.md. Source §4 Step 6 (add riders,
 * drivers and hub staff with photo and ID; training), §4.1 (licence, police
 * verification). Licence check is SIMULATED Sarathi (ULIP); the app link is a
 * SIMULATED SMS. Staff can't be assigned until licence (if needed) and police
 * verification are valid (PP-14 enforces it).
 */
import { CheckCircle2, MessageSquare, Pencil, Plus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sarathiCheck } from '@shared/engines/partnerOnboarding'
import { staffStatus } from '@shared/engines/partnerSettings'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { StaffInput } from '@shared/store/partnerSettingsActions'
import type { FieldStaff } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { usePartnerSession } from './usePartnerSession'

const STATUS_TONE: Record<NonNullable<FieldStaff['status']>, Tone> = { active: 'success', inactive: 'neutral', blocked: 'danger' }
const ROLES: FieldStaff['role'][] = ['rider', 'driver', 'hub']

export default function PP29Staff() {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const today = istDate(now)
  const [editing, setEditing] = useState<FieldStaff | 'new' | null>(null)
  const [blocking, setBlocking] = useState<FieldStaff | null>(null)
  const staff = Object.values(data.fieldStaff)
    .filter((s) => s.partnerId === partner.id)
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
  const store = useDemoStore.getState

  const docs = (s: FieldStaff) => {
    const lic = s.role === 'hub' ? 'na' : !s.licenceValidTill ? 'missing' : s.licenceValidTill < today ? 'expired' : 'ok'
    return { lic, police: s.policeVerified }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp29.title')}
        subtitle={t('pp29.subtitle', { count: staff.length, active: staff.filter((s) => staffStatus(s) === 'active').length })}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('pp29.add')}
          </Button>
        }
        className="mb-0"
      />
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="staff">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('pp29.col.name')}</th>
              <th>{t('pp29.col.role')}</th>
              <th>{t('pp29.col.vehicle')}</th>
              <th>{t('pp29.col.status')}</th>
              <th>{t('pp29.col.training')}</th>
              <th>{t('pp29.col.docs')}</th>
              <th className="sr-only">{t('pp29.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const st = staffStatus(s)
              const d = docs(s)
              const assignable = st === 'active' && d.police && (d.lic === 'ok' || d.lic === 'na')
              return (
                <tr key={s.id} className="border-b last:border-0" aria-label={s.name}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">{s.name}</span>
                    <span className="tabular block text-caption text-muted-foreground">
                      {s.mobile} · {s.hubId ? data.hubs[s.hubId]?.name : partner.city}
                    </span>
                  </td>
                  <td>{t(`pp09.role.${s.role}`)}</td>
                  <td className="tabular">{s.vehicleId ? data.vehicles[s.vehicleId]?.regNo : '—'}</td>
                  <td>
                    <Chip tone={STATUS_TONE[st]}>{t(`pp29.status.${st}`)}</Chip>
                  </td>
                  <td>
                    <Chip tone={s.trained ? 'success' : 'warning'}>{t(s.trained ? 'pp29.trained' : 'pp29.notTrained')}</Chip>
                  </td>
                  <td className="text-caption">
                    {s.role !== 'hub' && (
                      <span className={d.lic === 'ok' ? 'block' : 'block font-medium text-status-danger'}>
                        {d.lic === 'ok' ? t('pp29.licenceTill', { date: formatDate(s.licenceValidTill!) }) : t(`pp29.licence.${d.lic}`)}
                      </span>
                    )}
                    <span className={d.police ? 'block' : 'block font-medium text-status-danger'}>{d.police ? t('pp29.policeOk') : t('pp29.policePending')}</span>
                    {st === 'active' && !assignable && <span className="block text-status-danger">{t('pp29.cantAssign')}</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label={t('pp29.editOne', { name: s.name })} onClick={() => setEditing(s)}>
                        <Pencil />
                      </Button>
                      {st === 'active' ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => (store().resendAppLink(s.id, user.id), toast.success(t('pp29.linkSent', { name: s.name, mobile: s.mobile })))}>
                            <MessageSquare /> {t('pp29.resend')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => (store().setStaffStatus(s.id, 'inactive', user.id), toast.success(t('pp29.deactivated', { name: s.name })))}>
                            {t('pp29.deactivate')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setBlocking(s)}>
                            {t('pp29.block')}
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => (store().setStaffStatus(s.id, 'active', user.id), toast.success(t('pp29.reactivated', { name: s.name })))}>
                          {t('pp29.reactivate')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <p className="text-caption text-muted-foreground">{t('pp29.rule')}</p>
      {editing && <StaffDialog staff={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(v) => !v && setBlocking(null)}
        title={t('pp29.blockTitle', { name: blocking?.name ?? '' })}
        body={t('pp29.blockBody')}
        confirmLabel={t('pp29.block')}
        destructive
        onConfirm={() => {
          if (blocking) {
            store().setStaffStatus(blocking.id, 'blocked', user.id)
            toast.success(t('pp29.blocked', { name: blocking.name }))
          }
          setBlocking(null)
        }}
      />
    </div>
  )
}

function StaffDialog({ staff, onClose }: { staff?: FieldStaff; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const vehicles = Object.values(data.vehicles).filter((v) => v.partnerId === partner.id && v.active !== false)
  const hubs = Object.values(data.hubs).filter((h) => h.partnerId === partner.id)
  const [f, setF] = useState<StaffInput>({
    name: staff?.name ?? '',
    role: staff?.role ?? 'rider',
    mobile: staff?.mobile ?? '',
    photo: staff?.photo ?? '',
    idProof: staff?.idProof ?? { kind: 'aadhaar', last4: '' },
    licenceNo: staff?.licenceNo ?? '',
    vehicleId: staff?.vehicleId ?? '',
    hubId: staff?.hubId ?? '',
    language: staff?.language ?? 'hi',
  })
  const [checked, setChecked] = useState<{ ok: boolean; till?: string }>()
  const [err, setErr] = useState('')
  const set = (patch: Partial<StaffInput>) => setF((x) => ({ ...x, ...patch }))
  const needsLicence = f.role !== 'hub'

  const verify = () => {
    const r = sarathiCheck(f.licenceNo ?? '')
    setChecked({ ok: r.ok, till: r.detail.validTill })
  }
  const save = () => {
    const store = useDemoStore.getState()
    const r = staff ? store.updateStaff(staff.id, { vehicleId: f.vehicleId, hubId: f.hubId, language: f.language, licenceNo: f.licenceNo, policeFile: f.policeFile, policeDate: f.policeDate }, user.id) : store.createStaff(partner.id, f, user.id)
    if (r.error) return setErr(t(`pp29.err.${r.error}`))
    toast.success(staff ? t('pp29.saved', { name: f.name }) : t('pp29.added', { name: f.name, mobile: f.mobile }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{staff ? t('pp29.editOne', { name: staff.name }) : t('pp29.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pp29.f.name')} htmlFor="s-name" required>
            <Input id="s-name" value={f.name} disabled={!!staff} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t('pp29.f.role')} htmlFor="s-role" required>
            <NativeSelect id="s-role" value={f.role} disabled={!!staff} onChange={(e) => set({ role: e.target.value as FieldStaff['role'] })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`pp09.role.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('pp29.f.mobile')} htmlFor="s-mobile" required hint={t('pp29.mobileHint')}>
            <Input id="s-mobile" inputMode="tel" value={f.mobile} disabled={!!staff} onChange={(e) => set({ mobile: e.target.value })} />
          </Field>
          <Field label={t('pp29.f.language')} htmlFor="s-lang" required>
            <NativeSelect id="s-lang" value={f.language} onChange={(e) => set({ language: e.target.value as FieldStaff['language'] })}>
              <option value="hi">हिन्दी</option>
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ</option>
            </NativeSelect>
          </Field>
          {!staff && (
            <>
              <Field label={t('pp09.idType')} htmlFor="s-idk" required>
                <NativeSelect id="s-idk" value={f.idProof.kind} onChange={(e) => set({ idProof: { ...f.idProof, kind: e.target.value as NonNullable<FieldStaff['idProof']>['kind'] } })}>
                  {(['aadhaar', 'dl', 'voterId'] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`pp09.idKind.${k}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t('pp09.idLast4')} htmlFor="s-id4" required>
                <Input id="s-id4" inputMode="numeric" maxLength={4} value={f.idProof.last4} onChange={(e) => set({ idProof: { ...f.idProof, last4: e.target.value.replace(/\D/g, '') } })} />
              </Field>
              <PhotoCapture label={t('pp09.photo')} caption={f.name || t('pp09.photo')} value={f.photo} onChange={(photo) => set({ photo })} idBase={`${partner.id}-staff`} className="sm:col-span-2" required />
            </>
          )}
          {needsLicence && (
            <Field
              label={t('pp29.f.licence')}
              htmlFor="s-lic"
              className="sm:col-span-2"
              hint={
                checked &&
                (checked.ok ? (
                  <span className="flex items-center gap-1 text-status-success">
                    <CheckCircle2 className="size-3.5" aria-hidden /> {t('pp29.licenceOk', { date: formatDate(checked.till!) })} <SimulatedTag />
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-status-danger">
                    <XCircle className="size-3.5" aria-hidden /> {t('pp29.licenceBad')}
                  </span>
                ))
              }
            >
              <div className="flex gap-2">
                <Input id="s-lic" placeholder="DL-0420190012345" value={f.licenceNo} onChange={(e) => (set({ licenceNo: e.target.value.toUpperCase() }), setChecked(undefined))} />
                <Button type="button" variant="outline" disabled={!f.licenceNo?.trim()} onClick={verify}>
                  {t('pp29.verify')}
                </Button>
              </div>
            </Field>
          )}
          {!(staff?.policeVerified ?? false) && (
            <>
              <Field label={t('pp29.f.police')} htmlFor="s-pv" hint={t('pp29.policeHint')}>
                <Input id="s-pv" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => set({ policeFile: e.target.files?.[0]?.name })} />
              </Field>
              <Field label={t('pp29.f.policeDate')} htmlFor="s-pvd">
                <Input id="s-pvd" type="date" value={f.policeDate ?? ''} onChange={(e) => set({ policeDate: e.target.value })} />
              </Field>
            </>
          )}
          {f.role !== 'hub' && (
            <Field label={t('pp29.f.vehicle')} htmlFor="s-veh">
              <NativeSelect id="s-veh" value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
                <option value="">{t('pp29.noVehicle')}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.regNo} · {v.type}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label={t('pp29.f.base')} htmlFor="s-base" required>
            <NativeSelect id="s-base" value={f.hubId} onChange={(e) => set({ hubId: e.target.value })}>
              <option value="">{t('pp29.baseCity', { city: partner.city })}</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
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
          <Button onClick={save}>{staff ? t('common.save') : t('pp29.addSend')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
