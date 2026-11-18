import { formatDate, formatDateTime, formatDayShort, formatINR, formatTime } from './format'
import { addDays, addDaysToDate, addHours, ist, istDate, minutesBetween, toIst } from './time'

describe('formatINR', () => {
  it('uses Indian digit grouping and two decimals', () => {
    expect(formatINR(180000)).toBe('₹1,80,000.00')
  })

  it('formats the hero shipment total', () => {
    expect(formatINR(3628.26)).toBe('₹3,628.26')
  })

  it('formats crores', () => {
    expect(formatINR(12345678.9)).toBe('₹1,23,45,678.90')
  })
})

describe('dates and times are shown in IST', () => {
  it('formats an IST timestamp', () => {
    expect(formatDateTime('2026-11-23T09:05:00+05:30')).toBe('23-Nov-2026 09:05')
  })

  it('converts other offsets to IST, whatever the viewer time zone', () => {
    // 18:30 UTC on the 22nd is 00:00 IST on the 23rd
    expect(formatDate('2026-11-22T18:30:00Z')).toBe('23-Nov-2026')
    expect(formatTime('2026-11-22T18:30:00Z')).toBe('00:00')
  })

  it('formats bare calendar dates without shifting them', () => {
    expect(formatDate('2026-12-03')).toBe('03-Dec-2026')
    expect(formatDayShort('2026-11-26')).toBe('Thu 26-Nov')
  })
})

describe('time helpers', () => {
  const now = ist('2026-11-23', '10:00')

  it('builds IST timestamps', () => {
    expect(now).toBe('2026-11-23T10:00:00+05:30')
    expect(toIst('2026-11-23T04:30:00Z')).toBe(now)
  })

  it('adds hours and days across midnight', () => {
    expect(addHours(now, 14)).toBe('2026-11-24T00:00:00+05:30')
    expect(addDays(now, 3)).toBe('2026-11-26T10:00:00+05:30')
    expect(istDate(addHours(now, 13.5))).toBe('2026-11-23')
  })

  it('adds calendar days across a month end', () => {
    expect(addDaysToDate('2026-11-23', 10)).toBe('2026-12-03')
  })

  it('measures minutes between instants', () => {
    expect(minutesBetween(now, addHours(now, 2))).toBe(120)
  })
})
