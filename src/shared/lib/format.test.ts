import { formatDate, formatDateTime, formatINR, formatTime } from './format'

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

describe('date and time', () => {
  const d = new Date(2026, 10, 23, 9, 5)

  it('formats dates as DD-Mon-YYYY', () => {
    expect(formatDate(d)).toBe('23-Nov-2026')
  })

  it('formats times in 24-hour', () => {
    expect(formatTime(new Date(2026, 10, 23, 18, 30))).toBe('18:30')
    expect(formatDateTime(d)).toBe('23-Nov-2026 09:05')
  })
})
