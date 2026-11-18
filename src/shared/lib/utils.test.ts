import { cn } from './utils'

describe('cn', () => {
  it('keeps a text colour next to a custom font size', () => {
    expect(cn('text-primary-foreground', 'text-table')).toBe('text-primary-foreground text-table')
  })

  it('still resolves real conflicts', () => {
    expect(cn('text-caption', 'text-body')).toBe('text-body')
    expect(cn('text-gray-700', 'text-primary-foreground')).toBe('text-primary-foreground')
  })
})
