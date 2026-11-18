import { useTranslation } from 'react-i18next'
import type { NavItem } from '@shared/nav'
import { AccessDenied, ScreenPlaceholder } from '@shared/ui/Page'

/** Screens that have been built, by screen id. Filled in as phases deliver them. */
export type ScreenMap = Record<string, React.ComponentType>

/** A nav page: blocked if the user's role can't see it, otherwise the built screen or its placeholder. */
export function Guarded<Ctx>({ item, ctx, screens }: { item: NavItem<Ctx>; ctx: Ctx; screens: ScreenMap }) {
  const { t } = useTranslation()
  if (item.visible && !item.visible(ctx)) return <AccessDenied />
  const Screen = screens[item.screenId]
  return Screen ? <Screen /> : <ScreenPlaceholder screenId={item.screenId} title={t(item.labelKey)} phase={item.phase} />
}
