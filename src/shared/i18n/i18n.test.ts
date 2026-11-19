/**
 * English + Hindi in every app (client §14): every English string has a Hindi
 * one with the same placeholders, so no screen silently falls back to English.
 */
import en from './en.json'
import hi from './hi.json'

type Tree = { [k: string]: string | Tree }

function flat(t: Tree, prefix = ''): Record<string, string> {
  return Object.entries(t).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? { ...out, [key]: v } : { ...out, ...flat(v, key) }
  }, {})
}

const E = flat(en as Tree)
const H = flat(hi as Tree)
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()

describe('i18n: English and Hindi', () => {
  it('has a Hindi string for every English key', () => {
    expect(Object.keys(E).filter((k) => !(k in H))).toEqual([])
  })

  it('has no Hindi keys that English lacks', () => {
    expect(Object.keys(H).filter((k) => !(k in E))).toEqual([])
  })

  it('keeps the same placeholders', () => {
    const wrong = Object.keys(E).filter((k) => k in H && placeholders(E[k]).join() !== placeholders(H[k]).join())
    expect(wrong).toEqual([])
  })
})
