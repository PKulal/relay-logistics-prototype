/** Wording of a 3-way match result (PP-26, ERP-32): "Mismatch: weight 58 vs 8 kg". */
import type { TFunction } from 'i18next'
import type { PartnerInvoiceLine } from '@shared/types'

export function lineResult(t: TFunction, l: PartnerInvoiceLine): string {
  if (l.result === 'match') return t('pp26.result.match')
  if (l.reason === 'weight') return t('pp26.result.weight', { billed: l.billedWeight, verified: l.verifiedWeight })
  return l.reason === 'noPod' ? t('pp26.result.noPod') : t('pp26.result.amount')
}
