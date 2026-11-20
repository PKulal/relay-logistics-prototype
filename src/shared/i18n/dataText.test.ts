import i18n from '@shared/i18n'
import { buildSeed } from '@/data/seed'
import { dataBody, dataTitle } from './dataText'
import { TITLE_KEYS } from './dataTextKeys'

const hi = i18n.getFixedT('hi')
const en = i18n.getFixedT('en')

describe('notification text in Hindi (Phase 6)', () => {
  it('every exact English title has a key whose English matches it', () => {
    for (const [title, key] of Object.entries(TITLE_KEYS)) expect(en(`nt.title.${key}`)).toBe(title)
  })

  it('every seeded notification title is worded in Hindi', () => {
    const missing = Object.values(buildSeed().notifications).filter((n) => dataTitle(n.title, hi) === n.title && !/^JOB-/.test(n.title))
    expect(missing.map((n) => n.title)).toEqual([])
  })

  it('templated titles keep their ids; bodies keep amounts', () => {
    expect(dataTitle('LGS-DEL-000781: delivered', hi)).toBe('LGS-DEL-000781: डिलीवर हुआ')
    expect(dataTitle('Invoice LGS/DL/25-26/04417 generated', hi)).toBe('इनवॉइस LGS/DL/25-26/04417 बनाया गया')
    expect(dataTitle('Payout released', en)).toBe('Payout released')
    expect(dataTitle('Fire NOC expires 30-Nov-2026', hi)).toBe('फ़ायर NOC की वैधता 30-Nov-2026 को खत्म')
    expect(dataBody('LGS-DEL-000786 · ₹72 · deducted from your next payout', hi, 'hi')).toBe('LGS-DEL-000786 · ₹72 · आपके अगले पेआउट से काटा जाएगा')
    expect(dataBody('₹2,41,800 · 12 shipments · due 01-Dec-2026', hi, 'en')).toBe('₹2,41,800 · 12 shipments · due 01-Dec-2026')
  })
})
