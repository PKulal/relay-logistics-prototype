/**
 * Logins (CP-01, PP-01, PA-02, ERP-01 and the launcher's persona picker).
 * Every login is written to the audit log (ERP-01 rule; ERP-43).
 */
import type { AppKey, DemoData, Id, IsoDateTime } from '@shared/types'
import { recordCustomerLogin } from './customerSettingsActions'
import { audit } from './erpActions'
import { recordPartnerLogin } from './partnerSettingsActions'

export function recordLogin(data: DemoData, app: AppKey, userId: Id, at: IsoDateTime): DemoData {
  let next = data
  if (app === 'customer') next = recordCustomerLogin(next, userId, at)
  if (app === 'partnerPortal') next = recordPartnerLogin(next, userId, at)
  return audit(next, { userId, app, action: 'login', recordId: userId, at })
}

/** CP-03 / PP-03: SIMULATED reset (no passwords are stored in the prototype); audited. */
export const recordPasswordReset = (data: DemoData, app: AppKey, userId: Id, at: IsoDateTime): DemoData => audit(data, { userId, app, action: 'password.reset', recordId: userId, at })

/** PA-03 Continue: permissions given and profile checked on the first login. */
export function activateFieldApp(data: DemoData, staffId: Id, at: IsoDateTime): DemoData {
  const s = data.fieldStaff[staffId]
  if (!s || s.appActivatedAt) return data
  return { ...data, fieldStaff: { ...data.fieldStaff, [staffId]: { ...s, appActivatedAt: at } } }
}
