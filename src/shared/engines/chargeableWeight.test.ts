import { cubicFeet, parcelChargeable, ptlChargeable, roundUpToHalf } from './chargeableWeight'

const carton = { l: 60, b: 40, h: 40, weight: 20 }
/** Weight-revision variant: the rider measures two boxes larger (seed-data.md §3). */
const larger = { l: 62, b: 42, h: 42, weight: 20 }

describe('PTL chargeable weight', () => {
  it('a 60 × 40 × 40 cm box is 3.39 cu ft (CP spec §7.2)', () => {
    expect(cubicFeet(carton)).toBeCloseTo(3.39, 2)
  })

  it('hero shipment: actual 120 kg, CFT 20.3 cu ft × 8 = 162 kg, chargeable 162 kg', () => {
    expect(ptlChargeable(Array(6).fill(carton), 8, 50)).toEqual({ actual: 120, cubicFeet: 20.3, volumetricOrCft: 162, chargeable: 162 })
  })

  it('weight revision: two boxes larger → chargeable 170 kg', () => {
    const pieces = [carton, carton, carton, carton, larger, larger]
    expect(ptlChargeable(pieces, 8, 50).chargeable).toBe(170)
  })

  it('never goes below the minimum chargeable weight', () => {
    expect(ptlChargeable([{ l: 30, b: 30, h: 30, weight: 12 }], 8, 50).chargeable).toBe(50)
    expect(ptlChargeable([{ l: 30, b: 30, h: 30, weight: 12 }], 8, 100).chargeable).toBe(100)
  })

  it('uses actual weight when it is higher than CFT weight', () => {
    expect(ptlChargeable([{ l: 50, b: 40, h: 30, weight: 140 }], 8, 50).chargeable).toBe(140)
  })
})

describe('Parcel chargeable weight', () => {
  it('Kaveri parcel: 40 × 30 × 30 cm, 6 kg → volumetric 7.2 kg → chargeable 7.5 kg', () => {
    expect(parcelChargeable([{ l: 40, b: 30, h: 30, weight: 6 }])).toEqual({ actual: 6, volumetricOrCft: 7.2, chargeable: 7.5 })
  })

  it('rounds up to the next 0.5 kg slab, per piece', () => {
    expect(roundUpToHalf(7.2)).toBe(7.5)
    expect(roundUpToHalf(7.5)).toBe(7.5)
    expect(roundUpToHalf(7.51)).toBe(8)
    // two pieces of 1.1 kg → 1.5 + 1.5 = 3 kg (not 2.5 kg)
    expect(parcelChargeable([{ l: 10, b: 10, h: 10, weight: 1.1 }, { l: 10, b: 10, h: 10, weight: 1.1 }]).chargeable).toBe(3)
  })
})
