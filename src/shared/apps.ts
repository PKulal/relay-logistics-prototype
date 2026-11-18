/** The four apps behind the launcher (CLAUDE.md "What this is"). */
export const APPS = [
  { id: 'customer', path: '/customer', i18nKey: 'apps.customer' },
  { id: 'partner-portal', path: '/partner', i18nKey: 'apps.partnerPortal' },
  { id: 'partner-app', path: '/app', i18nKey: 'apps.partnerApp' },
  { id: 'erp', path: '/erp', i18nKey: 'apps.erp' },
] as const

export type AppId = (typeof APPS)[number]['id']
