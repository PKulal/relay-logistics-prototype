/**
 * Builds an app's routes from its nav: every menu page becomes a route,
 * guarded by the same `visible` rule that hides it from the menu.
 */
import { Route } from 'react-router-dom'
import { navPages, type NavGroup } from '@shared/nav'
import { Guarded, type ScreenMap } from './Guarded'

export type { ScreenMap }

/** <Route> children for every page in the nav. */
export function navRoutes<Ctx>(nav: NavGroup<Ctx>[], ctx: Ctx, screens: ScreenMap = {}) {
  return navPages(nav).map((item) =>
    item.path === '' ? (
      <Route key="index" index element={<Guarded item={item} ctx={ctx} screens={screens} />} />
    ) : (
      <Route key={item.path} path={item.path} element={<Guarded item={item} ctx={ctx} screens={screens} />} />
    ),
  )
}
