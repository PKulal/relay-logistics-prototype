import { ewayBillCheck } from './ewayBill'

const hero = {
  goodsValue: 180000,
  originState: 'Delhi',
  destState: 'Karnataka',
  distanceKm: 1880,
  generatedOn: '2026-11-23',
  threshold: 50000,
  kmPerDay: 200,
}

describe('e-way bill', () => {
  it('hero: ₹1,80,000 inter-state over 1,880 km → required, 10 days, valid till 03-Dec', () => {
    expect(ewayBillCheck(hero)).toEqual({ required: true, reason: 'required', validityDays: 10, validTill: '2026-12-03' })
  })

  it('is not required at or below ₹50,000', () => {
    expect(ewayBillCheck({ ...hero, goodsValue: 50000 }).required).toBe(false)
    expect(ewayBillCheck({ ...hero, goodsValue: 50000 }).reason).toBe('belowThreshold')
  })

  it('is not required within one state', () => {
    expect(ewayBillCheck({ ...hero, destState: 'Delhi' }).reason).toBe('intraState')
  })

  it('validity is 1 day per 200 km, rounded up, at least 1 day', () => {
    expect(ewayBillCheck({ ...hero, distanceKm: 200 }).validityDays).toBe(1)
    expect(ewayBillCheck({ ...hero, distanceKm: 201 }).validityDays).toBe(2)
    expect(ewayBillCheck({ ...hero, distanceKm: 40 }).validityDays).toBe(1)
  })
})
