/**
 * ERP-42 role editor applied to the ERP menu: a role's per-screen override
 * (data.rolePermissions) replaces the default visibility from nav.ts, so the
 * menu, the routes and the URL check all follow it. "None" hides and blocks a
 * screen; View / Act / Approve open it.
 */
import { navPages, type NavGroup, type NavItem } from '@shared/nav'
import type { ErpRole, PermLevel } from '@shared/types'
import type { ErpCtx } from './nav'

export type Perms = Partial<Record<string, PermLevel>>

export function withPermissions(groups: NavGroup<ErpCtx>[], perms: Perms | undefined): NavGroup<ErpCtx>[] {
  if (!perms || !Object.keys(perms).length) return groups
  // Children take the parent's rule into their own, so the parent can simply show when any child does
  const map = (items: NavItem<ErpCtx>[], parent?: (c: ErpCtx) => boolean): NavItem<ErpCtx>[] =>
    items.map((i) => {
      const own = parent && i.visible ? (c: ErpCtx) => parent(c) && i.visible!(c) : (i.visible ?? parent)
      if (i.children) {
        const children = map(i.children, own)
        return { ...i, children, visible: (c: ErpCtx) => children.some((ch) => !ch.visible || ch.visible(c)) }
      }
      const o = perms[i.screenId]
      return { ...i, visible: o ? () => o !== 'none' : own }
    })
  return groups.map((g) => ({ ...g, items: map(g.items) }))
}

/** One row per ERP screen for the role editor (unique screen ids, menu order). */
export function erpScreens(groups: NavGroup<ErpCtx>[]): { screenId: string; labelKey: string; group?: string; visible?: (c: ErpCtx) => boolean }[] {
  const seen = new Set<string>()
  const out: { screenId: string; labelKey: string; group?: string; visible?: (c: ErpCtx) => boolean }[] = []
  for (const g of groups) {
    for (const p of navPages([{ items: g.items }])) {
      if (seen.has(p.screenId)) continue
      seen.add(p.screenId)
      out.push({ screenId: p.screenId, labelKey: p.labelKey, group: g.labelKey, visible: p.visible })
    }
  }
  return out
}

/** Default level when there is no override: screens a role sees are Act; Approve for the role's own approval screens is not modelled. */
export const defaultLevel = (visible: ((c: ErpCtx) => boolean) | undefined, role: ErpRole): PermLevel => (!visible || visible({ role }) ? 'act' : 'none')
