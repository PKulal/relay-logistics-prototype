/**
 * ERP-42 Users, roles and access control — docs/04-erp-control-tower.md.
 * Source §14 (role-based access, single sign-on, two-factor for staff, audit
 * logs), §11 Dept 14 (access control). Super Admin edits; Leadership views.
 * The role editor's levels drive the menu and URL access (View opens a
 * screen, None hides it); every save is audited. Approval limits are not
 * built (the spec marks them assumed and the client document has no basis).
 */
import { Pencil, ShieldCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { StaffInput } from '@shared/store/adminActions'
import type { ErpRole, PermLevel, StaffUser } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { defaultLevel, erpScreens } from './access'
import { erpNav } from './nav'
import { useErpSession } from './useErpSession'

const ROLES: ErpRole[] = ['leadership', 'sales', 'pricing', 'customerSuccess', 'partnerManagement', 'networkPlanning', 'controlTower', 'hubOps', 'finance', 'claims', 'compliance', 'hubAuditor', 'superAdmin']
const LEVELS: PermLevel[] = ['none', 'view', 'act', 'approve']

export default function ERP42Access() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const canEdit = user.role === 'superAdmin'
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp42.title')} subtitle={canEdit ? t('erp42.subtitle') : t('erp42.viewOnly')} className="mb-0" />
      <div role="tablist" aria-label={t('erp42.title')} className="flex w-fit rounded-lg border bg-card p-0.5">
        {(['users', 'roles'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md px-3 py-1 text-caption font-medium', tab === k && 'bg-primary text-primary-foreground')}>
            {t(`erp42.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'users' ? <Users canEdit={canEdit} /> : <Roles canEdit={canEdit} />}
    </div>
  )
}

function Users({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const { user: me } = useErpSession()
  const staff = useData((d) => d.staff)
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null)
  const [disabling, setDisabling] = useState<StaffUser | null>(null)
  const list = Object.values(staff).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
  const setEnabled = (u: StaffUser, on: boolean) => {
    const r = useDemoStore.getState().setStaffUserEnabled(u.id, on, me.id)
    if (r.error) toast.error(t(`erp42.err.${r.error}`))
    else toast.success(t(on ? 'erp42.enabled' : 'erp42.disabled', { name: u.name }))
  }
  return (
    <>
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <ShieldCheck className="size-4 text-status-success" aria-hidden /> {t('erp42.twoFactor')}
          </p>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <UserPlus /> {t('erp42.add')}
            </Button>
          )}
        </div>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="staff-users">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp42.col.name')}</th>
              <th>{t('erp42.col.role')}</th>
              <th>{t('erp42.col.regions')}</th>
              <th>{t('erp42.col.twoFactor')}</th>
              <th>{t('erp42.col.status')}</th>
              {canEdit && <th className="sr-only">{t('erp42.col.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const off = u.status === 'disabled'
              return (
                <tr key={u.id} className="border-b last:border-0" aria-label={u.name}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-caption text-muted-foreground">
                      {u.title} · {u.email}
                    </span>
                  </td>
                  <td>
                    <Chip tone="neutral">{t(`roles.erp.${u.role}`)}</Chip>
                  </td>
                  <td className="text-caption">{u.regions?.length ? u.regions.join(', ') : t('erp42.allRegions')}</td>
                  <td>
                    <Chip tone="success">{t('erp42.on')}</Chip>
                  </td>
                  <td>
                    <Chip tone={off ? 'neutral' : 'success'}>{t(off ? 'erp42.st.disabled' : 'erp42.st.active')}</Chip>
                  </td>
                  {canEdit && (
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={t('erp42.editOne', { name: u.name })} onClick={() => setEditing(u)}>
                          <Pencil />
                        </Button>
                        {off ? (
                          <Button size="sm" variant="outline" onClick={() => setEnabled(u, true)}>
                            {t('erp42.enable')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={u.id === me.id} onClick={() => setDisabling(u)}>
                            {t('erp42.disable')}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      {editing && <UserDialog u={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!disabling}
        onOpenChange={(v) => !v && setDisabling(null)}
        title={t('erp42.disableTitle', { name: disabling?.name ?? '' })}
        body={t('erp42.disableBody')}
        confirmLabel={t('erp42.disable')}
        destructive
        onConfirm={() => {
          if (disabling) setEnabled(disabling, false)
          setDisabling(null)
        }}
      />
    </>
  )
}

function UserDialog({ u, onClose }: { u?: StaffUser; onClose: () => void }) {
  const { t } = useTranslation()
  const { user: me } = useErpSession()
  const pincodes = useData((d) => d.pincodes)
  const regions = [...new Set(Object.values(pincodes).map((p) => p.region))].sort()
  const [f, setF] = useState<StaffInput>({ name: u?.name ?? '', email: u?.email ?? '', title: u?.title ?? '', role: u?.role ?? 'controlTower', regions: u?.regions ?? [] })
  const [err, setErr] = useState('')
  const save = () => {
    const store = useDemoStore.getState()
    const r = u ? store.updateStaffUser(u.id, f, me.id) : store.addStaffUser(f, me.id)
    if (r.error) return setErr(t(`erp42.err.${r.error}`))
    toast.success(u ? t('erp42.saved', { name: f.name }) : t('erp42.added', { name: f.name }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{u ? t('erp42.editOne', { name: u.name }) : t('erp42.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('erp42.f.name')} htmlFor="eu-name" required>
            <Input id="eu-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('erp42.f.email')} htmlFor="eu-email" required hint={t('erp42.emailHint')}>
            <Input id="eu-email" type="email" disabled={!!u} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={t('erp42.f.title')} htmlFor="eu-title" required>
            <Input id="eu-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label={t('erp42.f.role')} htmlFor="eu-role" required>
            <NativeSelect id="eu-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as ErpRole })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.erp.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-1 sm:col-span-2">
            <legend className="mb-1 text-caption font-medium">{t('erp42.f.regions')}</legend>
            <div className="grid grid-cols-2 gap-1">
              {regions.map((r) => (
                <label key={r} className="flex items-center gap-2 text-caption">
                  <Checkbox checked={f.regions.includes(r)} onCheckedChange={(v) => setF({ ...f, regions: v ? [...f.regions, r] : f.regions.filter((x) => x !== r) })} /> {r}
                </label>
              ))}
            </div>
            <span className="text-caption text-muted-foreground">{t('erp42.regionsHint')}</span>
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

function Roles({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const perms = useData((d) => d.rolePermissions)
  const [role, setRole] = useState<ErpRole>('controlTower')
  const screens = erpScreens(erpNav)
  const over = perms[role] ?? {}
  return (
    <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp42.tab.roles')}>
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4">
        <Field label={t('erp42.role')} htmlFor="r-role" small>
          <NativeSelect id="r-role" value={role} onChange={(e) => setRole(e.target.value as ErpRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.erp.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <p className="pb-2 text-caption text-muted-foreground">{t('erp42.rolesNote')}</p>
      </div>
      <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="role-grid">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="px-4 py-2">{t('erp42.col.screen')}</th>
            {LEVELS.map((l) => (
              <th key={l} className="text-center">
                {t(`erp42.lvl.${l}`)}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {screens.map((s) => {
            const def = defaultLevel(s.visible, role)
            const level = over[s.screenId] ?? def
            const locked = !canEdit || (role === 'superAdmin' && s.screenId === 'ERP-42')
            return (
              <tr key={s.screenId} className="border-b last:border-0" aria-label={s.screenId}>
                <td className="px-4 py-1.5">
                  <span className="tabular text-caption text-muted-foreground">{s.screenId}</span> {t(s.labelKey)}
                </td>
                {LEVELS.map((l) => (
                  <td key={l} className="text-center">
                    <input
                      type="radio"
                      name={`p-${s.screenId}`}
                      aria-label={`${s.screenId} ${t(`erp42.lvl.${l}`)}`}
                      checked={level === l}
                      disabled={locked}
                      onChange={() => {
                        useDemoStore.getState().setRolePermission(role, s.screenId, l === def ? undefined : l, user.id)
                        toast.success(t('erp42.permSaved', { role: t(`roles.erp.${role}`), screen: s.screenId, level: t(`erp42.lvl.${l}`) }))
                      }}
                      className="size-4 accent-[var(--accent)]"
                    />
                  </td>
                ))}
                <td className="text-caption">{over[s.screenId] && <Chip tone="info">{t('erp42.changed')}</Chip>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
