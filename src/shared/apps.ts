import type { AppKey } from '@shared/types'

/** The four apps behind the launcher (CLAUDE.md "What this is"). */
export const APPS = [
  { id: 'customer', key: 'customer', path: '/customer', i18nKey: 'apps.customer' },
  { id: 'partner-portal', key: 'partnerPortal', path: '/partner', i18nKey: 'apps.partnerPortal' },
  { id: 'partner-app', key: 'partnerApp', path: '/app', i18nKey: 'apps.partnerApp' },
  { id: 'erp', key: 'erp', path: '/erp', i18nKey: 'apps.erp' },
] as const satisfies readonly { id: string; key: AppKey; path: string; i18nKey: string }[]

/** Used as the data-app attribute that sets each app's --accent. */
export type AppId = (typeof APPS)[number]['id']

export const appByKey = (key: AppKey) => APPS.find((a) => a.key === key)!
export const appById = (id: AppId) => APPS.find((a) => a.id === id)!
