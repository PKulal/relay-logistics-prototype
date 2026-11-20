/**
 * Login lookups for CP-01, PP-01, PA-02 and ERP-01. SIMULATED authentication:
 * any password of 8+ characters works for a seeded user; OTP is 123456 (seed-data.md §2).
 */
import type { AppKey, DemoData, Id } from '@shared/types'

export type LoginError = 'unknown' | 'disabled' | 'fieldStaff' | 'invalid'
export type LoginResult = { ok: true; userId: Id; name: string; mobile: string } | { ok: false; reason: LoginError }

const digits = (s: string) => s.replace(/\D/g, '').slice(-10)
const sameMobile = (a: string, b: string) => digits(a).length === 10 && digits(a) === digits(b)
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())
/** 10 digits starting 6–9 (CP-01). */
export const validMobile = (m: string) => /^[6-9]\d{9}$/.test(m.replace(/\D/g, '').slice(-10)) && m.replace(/\D/g, '').length >= 10
export const validPassword = (p: string) => p.length >= 8

/** CP-03: min 8 characters with a letter and a number; strength 0–4 for the meter. */
export function passwordStrength(p: string): number {
  return [p.length >= 8, /[a-z]/i.test(p) && /\d/.test(p), /[A-Z]/.test(p) && /[a-z]/.test(p), /[^A-Za-z0-9]/.test(p) || p.length >= 12].filter(Boolean).length
}
export const resetPasswordOk = (p: string) => p.length >= 8 && /[a-z]/i.test(p) && /\d/.test(p)

export function findLogin(data: DemoData, app: AppKey, by: { email?: string; mobile?: string }): LoginResult {
  const { email, mobile } = by
  if (email !== undefined && !validEmail(email)) return { ok: false, reason: 'invalid' }
  if (mobile !== undefined && !validMobile(mobile)) return { ok: false, reason: 'invalid' }
  const match = <T extends { email?: string; mobile?: string }>(u: T) => (email !== undefined ? !!u.email && sameEmail(u.email, email) : !!u.mobile && sameMobile(u.mobile, mobile!))
  if (app === 'customer') {
    const u = Object.values(data.customerUsers).find(match)
    if (!u) return { ok: false, reason: 'unknown' }
    return u.status === 'disabled' ? { ok: false, reason: 'disabled' } : { ok: true, userId: u.id, name: u.name, mobile: u.mobile }
  }
  if (app === 'partnerPortal') {
    const u = Object.values(data.partnerUsers).find(match)
    if (!u) return mobile && Object.values(data.fieldStaff).some((s) => sameMobile(s.mobile, mobile)) ? { ok: false, reason: 'fieldStaff' } : { ok: false, reason: 'unknown' }
    return u.status === 'disabled' ? { ok: false, reason: 'disabled' } : { ok: true, userId: u.id, name: u.name, mobile: u.mobile }
  }
  if (app === 'partnerApp') {
    const s = mobile ? Object.values(data.fieldStaff).find((x) => sameMobile(x.mobile, mobile)) : undefined
    if (!s) return { ok: false, reason: 'unknown' }
    return (s.status ?? 'active') !== 'active' ? { ok: false, reason: 'disabled' } : { ok: true, userId: s.id, name: s.name, mobile: s.mobile }
  }
  const u = email ? Object.values(data.staff).find((x) => sameEmail(x.email, email)) : undefined
  if (!u) return { ok: false, reason: 'unknown' }
  return u.status === 'disabled' ? { ok: false, reason: 'disabled' } : { ok: true, userId: u.id, name: u.name, mobile: '' }
}

/** 98100 23456 → 98XXX XX456 (CP-02 rule). */
export const maskForOtp = (mobile: string) => {
  const d = mobile.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `${d.slice(0, 2)}XXX XX${d.slice(7)}` : mobile
}
