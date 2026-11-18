import { buildSeed } from '@data/seed'
import { buildPrice, parcelZone, priceLine } from './pricing'
import { quote, QuoteError, type QuoteInput } from './quote'

const data = buildSeed()
const { surcharges } = data.rateCards['RC-STANDARD']
const carton = { l: 60, b: 40, h: 40, weight: 20 }

const heroInput: QuoteInput = {
  customerId: 'C-SHARMA',
  originPincode: '110020',
  destPincode: '580030',
  serviceKind: 'ptl',
  service: 'expressPtl',
  pieces: Array(6).fill(carton),
  declaredValue: 180000,
  addOns: { appointment: true, insurance: true, specialHandling: false },
  paymentMode: 'tbb',
}

describe('hero shipment LGS-DEL-000781 (seed-data.md §3)', () => {
  const q = quote(data, heroInput)
  const amounts = Object.fromEntries(q.price.lines.map((l) => [l.code, l.amount]))

  it('prices every line as documented', () => {
    expect(amounts).toEqual({ freight: 2268, fuel: 226.8, docket: 100, appointment: 300, fov: 180 })
    expect(q.price.lines[0].basis).toEqual({ kg: 162, rate: 14 })
  })

  it('subtotal ₹3,074.80, GST ₹553.46, total ₹3,628.26', () => {
    expect(q.price).toMatchObject({ subtotal: 3074.8, gst: 553.46, total: 3628.26 })
  })

  it('runs on the Delhi → Hubballi lane, 5 legs, 3 days', () => {
    expect(q.lane?.id).toBe('LN-DEL-HBL')
    expect(q.pattern).toHaveLength(5)
    expect(q.transitDays).toBe(3)
    expect(q.weights.chargeable).toBe(162)
  })
})

describe('weight revision variant', () => {
  it('170 kg → new total ₹3,773.64, i.e. + ₹145.38', () => {
    const larger = { l: 62, b: 42, h: 42, weight: 20 }
    const revised = quote(data, { ...heroInput, pieces: [carton, carton, carton, carton, larger, larger] })
    expect(revised.weights.chargeable).toBe(170)
    expect(revised.price.total).toBe(3773.64)
    expect(Math.round((revised.price.total - 3628.26) * 100) / 100).toBe(145.38)
  })
})

describe('Kaveri parcel LGS-MYS-000112 (CP spec §7.3, example 2)', () => {
  const q = quote(data, {
    customerId: 'C-KAVERI',
    originPincode: '570001',
    destPincode: '411001',
    serviceKind: 'parcel',
    service: 'standard',
    pieces: [{ l: 40, b: 30, h: 30, weight: 6 }],
    declaredValue: 4500,
    addOns: { appointment: false, insurance: false, specialHandling: false },
    paymentMode: 'paid',
  })

  it('is Zone D', () => expect(q.zone).toBe('D'))

  it('freight ₹405 (₹55 + 14 × ₹25), fuel ₹40.50, docket ₹30', () => {
    expect(priceLine(q.price, 'freight')).toBe(405)
    expect(q.price.lines[0].basis).toMatchObject({ slabs: 15, first: 55, additional: 25 })
    expect(priceLine(q.price, 'fuel')).toBe(40.5)
    expect(priceLine(q.price, 'docket')).toBe(30)
  })

  it('subtotal ₹475.50, GST ₹85.59, total ₹561.09', () => {
    expect(q.price).toMatchObject({ subtotal: 475.5, gst: 85.59, total: 561.09 })
  })
})

describe('surcharges (seed-data.md §8)', () => {
  const base = {
    serviceKind: 'ptl' as const,
    chargeableKg: 100,
    ptlPerKg: 10,
    surcharges,
    gstPct: 18,
    pieces: 4,
    declaredValue: 50000,
    addOns: { appointment: false, insurance: false, specialHandling: false },
    paymentMode: 'tbb' as const,
    oda: false,
  }

  it('ODA is ₹3/kg with a ₹250 minimum', () => {
    expect(priceLine(buildPrice({ ...base, oda: true }), 'oda')).toBe(300)
    expect(priceLine(buildPrice({ ...base, oda: true, chargeableKg: 50 }), 'oda')).toBe(250)
  })

  it('COD fee is 1.5% with a ₹50 minimum', () => {
    expect(priceLine(buildPrice({ ...base, paymentMode: 'cod', codAmount: 20000 }), 'cod')).toBe(300)
    expect(priceLine(buildPrice({ ...base, paymentMode: 'cod', codAmount: 2000 }), 'cod')).toBe(50)
  })

  it('To-Pay fee ₹150; special handling ₹100 per piece', () => {
    expect(priceLine(buildPrice({ ...base, paymentMode: 'toPay' }), 'toPay')).toBe(150)
    expect(priceLine(buildPrice({ ...base, addOns: { ...base.addOns, specialHandling: true } }), 'specialHandling')).toBe(400)
  })

  it('omits lines that do not apply', () => {
    expect(buildPrice(base).lines.map((l) => l.code)).toEqual(['freight', 'fuel', 'docket'])
  })
})

describe('parcel zones', () => {
  const p = (city: string, state: string, metro = false, special = false) => ({ city, state, metro, special })
  it('A same city · B same state · C metro to metro · D rest · E special', () => {
    expect(parcelZone(p('Mumbai', 'MH', true), p('Mumbai', 'MH', true))).toBe('A')
    expect(parcelZone(p('Mumbai', 'MH', true), p('Pune', 'MH', true))).toBe('B')
    expect(parcelZone(p('Mumbai', 'MH', true), p('New Delhi', 'DL', true))).toBe('C')
    expect(parcelZone(p('Mysuru', 'KA'), p('Pune', 'MH', true))).toBe('D')
    expect(parcelZone(p('Mumbai', 'MH', true), p('Guwahati', 'AS', false, true))).toBe('E')
  })
})

describe('booking checks in quote', () => {
  const err = (input: Partial<QuoteInput>) => {
    try {
      quote(data, { ...heroInput, ...input })
    } catch (e) {
      return (e as QuoteError).code
    }
    return 'ok'
  }

  it('rejects pincodes that are not serviceable', () => {
    expect(err({ destPincode: '600032' })).toBe('destNotServiceable')
    expect(err({ originPincode: '781001' })).toBe('originNotServiceable')
    expect(err({ destPincode: '999999' })).toBe('unknownPincode')
  })

  it('rejects routes with no lane (e.g. Hubballi → Mumbai)', () => {
    expect(err({ originPincode: '580030', destPincode: '400093' })).toBe('noLane')
  })

  it('rejects a parcel tier sent as PTL', () => {
    expect(err({ service: 'standard' })).toBe('serviceMismatch')
  })
})
