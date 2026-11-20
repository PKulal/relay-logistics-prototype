/**
 * CP-28 Users and roles — docs/01-customer-portal.md. Source §7.2 (Users &
 * Integrations: roles dispatch, finance, admin; pickup locations). Admin only.
 * Invites are SIMULATED email + SMS. The last active Admin can't be disabled
 * or downgraded.
 */
import { MailPlus, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { userStatus, usersOf } from '@shared/engines/customerSettings'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { UserInput } from '@shared/store/customerSettingsActions'
import type { CustomerRole, CustomerUser } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useCustomerSession } from './useCustomerSession'

const STATUS_TONE: Record<NonNullable<CustomerUser['status']>, Tone> = { active: 'success', invited: 'info', disabled: 'neutral' }
const ROLES: CustomerRole[] = ['admin', 'dispatch', 'finance']

export default function CP28Users() {
  const { t } = useTranslation()
  const { user: me, customer } = useCustomerSession()
  const data = useData((d) => d)
  const users = usersOf(data, customer.id).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const [editing, setEditing] = useState<CustomerUser | 'new' | null>(null)
  const [disabling, setDisabling] = useState<CustomerUser | null>(null)
  const store = useDemoStore.getState

  const access = (u: CustomerUser) => (u.locationIds.length === 0 || u.locationIds.length === locations.length ? t('cp28.allLocations') : u.locationIds.map((id) => data.pickupLocations[id]?.name).join(', '))

  const setEnabled = (u: CustomerUser, enabled: boolean) => {
    const r = store().setCustomerUserEnabled(u.id, enabled, me.id)
    if (r.error === 'lastAdmin') toast.error(t('cp28.lastAdmin'))
    else toast.success(t(enabled ? 'cp28.enabled' : 'cp28.disabled', { name: u.name }))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp28.title')}
        subtitle={t('cp28.subtitle', { count: users.length })}
        actions={
          <Button onClick={() => setEditing('new')}>
            <MailPlus /> {t('cp28.invite')}
          </Button>
        }
        className="mb-0"
      />
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="users">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('cp28.col.name')}</th>
              <th>{t('cp28.col.role')}</th>
              <th>{t('cp28.col.access')}</th>
              <th>{t('cp28.col.status')}</th>
              <th>{t('cp28.col.lastLogin')}</th>
              <th className="sr-only">{t('cp28.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const st = userStatus(u)
              return (
                <tr key={u.id} className="border-b last:border-0" aria-label={u.name}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">
                      {u.name} {u.id === me.id && <span className="text-caption text-muted-foreground">({t('cp28.you')})</span>}
                    </span>
                    <span className="block text-caption text-muted-foreground">
                      {u.email} · {u.mobile}
                    </span>
                  </td>
                  <td>
                    <Chip tone="neutral">{t(`roles.customer.${u.role}`)}</Chip>
                  </td>
                  <td className="text-caption">{access(u)}</td>
                  <td>
                    <Chip tone={STATUS_TONE[st]}>{t(`cp28.status.${st}`)}</Chip>
                  </td>
                  <td className="tabular text-caption">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label={t('cp28.editUser', { name: u.name })} onClick={() => setEditing(u)}>
                        <Pencil />
                      </Button>
                      {st !== 'disabled' && (
                        <Button size="sm" variant="outline" onClick={() => (store().resendInvite(u.id, me.id), toast.success(t(st === 'invited' ? 'cp28.resent' : 'cp28.resetSent', { name: u.name })))}>
                          {t(st === 'invited' ? 'cp28.resend' : 'cp28.reset')}
                        </Button>
                      )}
                      {st === 'disabled' ? (
                        <Button size="sm" variant="outline" onClick={() => setEnabled(u, true)}>
                          {t('cp28.enable')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={u.id === me.id} onClick={() => setDisabling(u)}>
                          {t('cp28.disable')}
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
      <p className="text-caption text-muted-foreground">{t('cp28.rule')}</p>

      {editing && <UserDialog user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!disabling}
        onOpenChange={(v) => !v && setDisabling(null)}
        title={t('cp28.disableTitle', { name: disabling?.name ?? '' })}
        body={t('cp28.disableBody')}
        confirmLabel={t('cp28.disable')}
        destructive
        onConfirm={() => {
          if (disabling) setEnabled(disabling, false)
          setDisabling(null)
        }}
      />
    </div>
  )
}

function UserDialog({ user, onClose }: { user?: CustomerUser; onClose: () => void }) {
  const { t } = useTranslation()
  const { user: me, customer } = useCustomerSession()
  const data = useData((d) => d)
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id && l.active !== false)
  const [f, setF] = useState<UserInput>(user ? { name: user.name, email: user.email, mobile: user.mobile, role: user.role, locationIds: user.locationIds, language: user.language } : { name: '', email: '', mobile: '', role: 'dispatch', locationIds: [], language: 'en' })
  const [err, setErr] = useState('')
  const all = f.locationIds.length === 0

  const save = () => {
    const store = useDemoStore.getState()
    const r = user ? store.updateCustomerUser(user.id, f, me.id) : store.inviteCustomerUser(customer.id, f, me.id)
    if (r.error) return setErr(t(`cp28.err.${r.error}`))
    toast.success(user ? t('cp28.saved', { name: f.name }) : t('cp28.invited', { name: f.name, email: f.email }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? t('cp28.editTitle', { name: user.name }) : t('cp28.invite')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('cp28.f.name')} htmlFor="u-name" required className="sm:col-span-2">
            <Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.email')} htmlFor="u-email" required>
            <Input id="u-email" type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.mobile')} htmlFor="u-mobile" required>
            <Input id="u-mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.role')} htmlFor="u-role" required>
            <NativeSelect id="u-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as CustomerRole })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.customer.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp28.f.language')} htmlFor="u-lang" required>
            <NativeSelect id="u-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as 'en' | 'hi' })}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-caption font-medium">{t('cp28.f.access')}</legend>
            <label className="flex items-center gap-2">
              <Checkbox checked={all} onCheckedChange={(v) => setF({ ...f, locationIds: v ? [] : locations.slice(0, 1).map((l) => l.id) })} />
              {t('cp28.allLocations')}
            </label>
            {!all &&
              locations.map((l) => (
                <label key={l.id} className="flex items-center gap-2 pl-6">
                  <Checkbox
                    checked={f.locationIds.includes(l.id)}
                    onCheckedChange={(v) => {
                      const ids = v ? [...f.locationIds, l.id] : f.locationIds.filter((x) => x !== l.id)
                      setF({ ...f, locationIds: ids.length ? ids : [] })
                    }}
                  />
                  {l.name}
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
          <Button onClick={save}>{user ? t('common.save') : t('cp28.sendInvite')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
