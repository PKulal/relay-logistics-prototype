import { buildBaseSeed, DEMO_START } from '@data/seed'
import { bookingChecks, type BookingCheckInput } from './bookingChecks'
import { pickupDates, pickupSlots } from './schedule'

const data = buildBaseSeed()
const hero: BookingCheckInput = { total: 3628.26, paymentMode: 'tbb', invoiceValue: 180000, invoiceDate: '2026-11-23', ewbRequired: true, hsn: '8537' }

describe('booking checks (CP spec §7.4)', () => {
  it('the hero booking passes', () => {
    expect(bookingChecks(data, data.customers['C-SHARMA'], hero, DEMO_START)).toEqual([])
  })

  it('credit: blocks a booking that would exceed available credit (₹1,55,800)', () => {
    expect(bookingChecks(data, data.customers['C-SHARMA'], { ...hero, total: 155800.01 }, DEMO_START)).toEqual(['creditExceeded'])
    expect(bookingChecks(data, data.customers['C-SHARMA'], { ...hero, total: 155800 }, DEMO_START)).toEqual([])
  })

  it('prepaid: blocks when the wallet does not cover the total', () => {
    const kaveri = data.customers['C-KAVERI']
    const parcel = { ...hero, total: 561.09, paymentMode: 'paid' as const, ewbRequired: false, hsn: '' }
    expect(bookingChecks(data, kaveri, parcel, DEMO_START)).toEqual([])
    expect(bookingChecks(data, { ...kaveri, walletBalance: 500 }, parcel, DEMO_START)).toEqual(['walletLow'])
  })

  it('COD above invoice value, missing HSN when an e-way bill is needed, future invoice date', () => {
    expect(
      bookingChecks(data, data.customers['C-SHARMA'], { ...hero, paymentMode: 'cod', codAmount: 180001, hsn: '', invoiceDate: '2026-11-24' }, DEMO_START),
    ).toEqual(['codTooHigh', 'hsnRequired', 'invoiceDateFuture'])
  })
})

describe('pickup slots (CP-13 Step 1)', () => {
  const okhla = { from: '10:00', to: '17:00' }
  const labels = (date: string, now = DEMO_START) => pickupSlots(okhla, date, now, '14:00').map((s) => `${s.from}–${s.to}`)

  it('Okhla 10:00–17:00 gives 2-hour slots 10–12, 12–14, 14–16 on a future day', () => {
    expect(labels('2026-11-24')).toEqual(['10:00–12:00', '12:00–14:00', '14:00–16:00'])
  })

  it('today at 10:00: only slots that have not started (the hero takes 14:00–16:00)', () => {
    expect(labels('2026-11-23')).toEqual(['12:00–14:00', '14:00–16:00'])
  })

  it('no same-day slots after the 14:00 cut-off, none on Sunday, none in the past', () => {
    expect(labels('2026-11-23', '2026-11-23T14:05:00+05:30')).toEqual([])
    expect(labels('2026-11-29')).toEqual([])
    expect(labels('2026-11-21')).toEqual([])
  })

  it('offers today and the next working days, skipping Sunday', () => {
    expect(pickupDates(DEMO_START, '14:00', 7)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-30'])
    expect(pickupDates('2026-11-23T15:00:00+05:30', '14:00', 1)).toEqual(['2026-11-24'])
  })
})
