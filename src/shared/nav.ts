/**
 * Navigation model shared by the app shells. Each app lists its menu as data:
 * the menu, the routes and the access check are all generated from it, so a
 * screen that's hidden from a role is also blocked by URL (CP spec §3.4).
 */
import type { LucideIcon } from 'lucide-react'

export interface NavItem<Ctx> {
  /** Route segment under the app root ('' = app home) */
  path: string
  /** i18n key for the menu label */
  labelKey: string
  /** Spec screen id(s), e.g. "CP-13" */
  screenId: string
  icon?: LucideIcon
  /** Build-plan phase that delivers this screen (shown on its placeholder) */
  phase: number
  /** Who can see / open it. Omitted = everyone in the app. */
  visible?: (ctx: Ctx) => boolean
  /** Sub-items (shown as a group); a group with children has no page of its own */
  children?: NavItem<Ctx>[]
}

export interface NavGroup<Ctx> {
  /** i18n key for the group heading (ERP department groups); omit for an ungrouped list */
  labelKey?: string
  items: NavItem<Ctx>[]
}

/** Visible items for a user, dropping groups and parents that end up empty. */
export function visibleNav<Ctx>(groups: NavGroup<Ctx>[], ctx: Ctx): NavGroup<Ctx>[] {
  const filter = (items: NavItem<Ctx>[]): NavItem<Ctx>[] =>
    items
      .filter((i) => !i.visible || i.visible(ctx))
      .map((i) => (i.children ? { ...i, children: filter(i.children) } : i))
      .filter((i) => !i.children || i.children.length > 0)
  return groups.map((g) => ({ ...g, items: filter(g.items) })).filter((g) => g.items.length > 0)
}

/** Every page (leaf) in the nav, with its full path. Used to build routes. */
export function navPages<Ctx>(groups: NavGroup<Ctx>[]): NavItem<Ctx>[] {
  const out: NavItem<Ctx>[] = []
  const walk = (items: NavItem<Ctx>[], parentVisible?: (ctx: Ctx) => boolean) => {
    for (const i of items) {
      const visible = parentVisible && i.visible ? (c: Ctx) => parentVisible(c) && i.visible!(c) : (i.visible ?? parentVisible)
      if (i.children) walk(i.children, visible)
      else out.push({ ...i, visible })
    }
  }
  groups.forEach((g) => walk(g.items))
  return out
}
