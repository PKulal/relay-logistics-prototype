/**
 * PP-34 Portal users and roles — docs/02-partner-portal.md. Source §5.1
 * (partner admin), §14 (role-based access). Admin only. Invites are SIMULATED
 * email + SMS. At least one active Partner Admin must remain.
 */
import { MailPlus, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { portalUserStatus } from '@shared/engines/partnerSettings'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { PortalUserInput } from '@shared/store/partnerSettingsActions'
import type { PartnerRole, PartnerUser } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

const ROLES: PartnerRole[] = ['admin', 'operations', 'finance']
const TONE = { active: 'success', invited: 'info', disabled: 'neutral' } as const

export default function PP34Users() {
  const { t } = useTranslation()
  const { user: me, partner } = usePartnerSession()
  const data = useData((d) => d)
  const users = Object.values(data.partnerUsers)
    .filter((u) => u.partnerId === partner.id)
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
  const hubs = Object.values(data.hubs).filter((h) => h.partnerId === partner.id)
  const [editing, setEditing] = useState<PartnerUser | 'new' | null>(null)
  const [disabling, setDisabling] = useState<PartnerUser | null>(null)

  const setEnabled = (u: PartnerUser, on: boolean) => {
    const r = useDemoStore.getState().setPortalUserEnabled(u.id, on, me.id)
    if (r.error) toast.error(t('pp34.lastAdmin'))
    else toast.success(t(on ? 'cp28.enabled' : 'cp28.disabled', { name: u.name }))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp34.title')}
        subtitle={t('cp28.subtitle', { count: users.length })}
        actions={
          <Button onClick={() => setEditing('new')}>
            <MailPlus /> {t('cp28.invite')}
          </Button>
        }
        className="mb-0"
      />
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="portal-users">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('cp28.col.name')}</th>
              <th>{t('cp28.col.role')}</th>
              <th>{t('pp34.access')}</th>
              <th>{t('cp28.col.status')}</th>
              <th>{t('cp28.col.lastLogin')}</th>
              <th className="sr-only">{t('cp28.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const st = portalUserStatus(u)
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
                    <Chip tone="neutral">{t(`roles.partner.${u.role}`)}</Chip>
                  </td>
                  <td className="text-caption">{u.hubIds?.length ? u.hubIds.map((id) => data.hubs[id]?.name).join(', ') : t('pp34.all')}</td>
                  <td>
                    <Chip tone={TONE[st]}>{t(`cp28.status.${st}`)}</Chip>
                  </td>
                  <td className="tabular text-caption">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label={t('cp28.editUser', { name: u.name })} onClick={() => setEditing(u)}>
                        <Pencil />
                      </Button>
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
      <p className="text-caption text-muted-foreground">{t('pp34.rule')}</p>
      {editing && <UserDialog u={editing === 'new' ? undefined : editing} hubs={hubs.map((h) => ({ id: h.id, name: h.name }))} onClose={() => setEditing(null)} />}
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

function UserDialog({ u, hubs, onClose }: { u?: PartnerUser; hubs: { id: string; name: string }[]; onClose: () => void }) {
  const { t } = useTranslation()
  const { user: me, partner } = usePartnerSession()
  const [f, setF] = useState<PortalUserInput>({ name: u?.name ?? '', email: u?.email ?? '', mobile: u?.mobile ?? '', role: u?.role ?? 'operations', hubIds: u?.hubIds ?? [] })
  const [err, setErr] = useState('')
  const save = () => {
    const store = useDemoStore.getState()
    const r = u ? store.updatePortalUser(u.id, f, me.id) : store.invitePortalUser(partner.id, f, me.id)
    if (r.error) return setErr(r.error === 'lastAdmin' ? t('pp34.lastAdmin') : t(`cp28.err.${r.error}`))
    toast.success(u ? t('cp28.saved', { name: f.name }) : t('cp28.invited', { name: f.name, email: f.email }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{u ? t('cp28.editTitle', { name: u.name }) : t('cp28.invite')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('cp28.f.name')} htmlFor="pu-name" required className="sm:col-span-2">
            <Input id="pu-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.email')} htmlFor="pu-email" required>
            <Input id="pu-email" type="email" disabled={!!u} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.mobile')} htmlFor="pu-mobile" required>
            <Input id="pu-mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
          </Field>
          <Field label={t('cp28.f.role')} htmlFor="pu-role" required>
            <NativeSelect id="pu-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as PartnerRole })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.partner.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {hubs.length > 0 && (
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="mb-1 text-caption font-medium">{t('pp34.access')}</legend>
              {hubs.map((h) => (
                <label key={h.id} className="flex items-center gap-2">
                  <Checkbox checked={f.hubIds.includes(h.id)} onCheckedChange={(v) => setF({ ...f, hubIds: v ? [...f.hubIds, h.id] : f.hubIds.filter((x) => x !== h.id) })} /> {h.name}
                </label>
              ))}
              <span className="text-caption text-muted-foreground">{t('pp34.accessHint')}</span>
            </fieldset>
          )}
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
          <Button onClick={save}>{u ? t('common.save') : t('cp28.sendInvite')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
