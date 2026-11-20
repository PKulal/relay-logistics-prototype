/**
 * Data text in the viewer's language (Phase 6). Notifications are stored in
 * English, as a real system would store the message it sent; screens word them
 * in the viewer's language. Ids, names and amounts inside the text stay as they are.
 */
import type { TFunction } from 'i18next'
import type { Notification } from '@shared/types'
import { BODY_KEYS, TITLE_KEYS, TITLE_PATTERNS } from './dataTextKeys'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const BODY_RES: [RegExp, string][] = BODY_KEYS.map(([en, key]) => [new RegExp(`(?<![\\w-])${escape(en)}(?![\\w-])`, 'g'), key])

/** The title in the current language; unknown titles are shown as stored. */
export function dataTitle(title: string, t: TFunction): string {
  const key = TITLE_KEYS[title]
  if (key) return t(`nt.title.${key}`)
  for (const [re, k] of TITLE_PATTERNS) {
    const m = re.exec(title)
    if (!m) continue
    const p: Record<string, string> = { ...m.groups }
    const doc = BODY_KEYS.find(([en]) => en === p.doc)
    if (doc) p.doc = t(`nt.body.${doc[1]}`)
    if (p.kind) p.kind = t(`cp17.exception.${p.kind}`, { defaultValue: p.kind })
    return t(`nt.p.${k}`, p)
  }
  return title
}

/** The body with its known phrases in the current language. */
export function dataBody(body: string, t: TFunction, lang: string): string {
  if (!lang.startsWith('hi')) return body
  const m = /^Credit note (?<cn>\S+) for (?<amount>₹[\d,.]+) on (?<lr>\S+)$/.exec(body)
  if (m) return t('nt.bp.creditNote', { ...m.groups })
  return BODY_RES.reduce((s, [re, key]) => s.replace(re, t(`nt.body.${key}`)), body)
}

export const notificationText = (n: Notification, t: TFunction, lang: string) => ({ title: dataTitle(n.title, t), body: dataBody(n.body, t, lang) })
