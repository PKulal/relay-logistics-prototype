/** Partner finance building blocks: a deduction with its evidence link (source §5.1 "deductions with evidence"). */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { PayoutDeductionKind } from '@shared/types'

export function DeductionLink({ d, base = '/partner' }: { d: { kind?: PayoutDeductionKind; reason: string; ref?: string }; base?: string }) {
  const { t } = useTranslation()
  const kind = d.kind ?? 'penalty'
  const label = t(`payout.ded.${kind}`)
  const to = !d.ref ? undefined : kind === 'claim' ? `${base}/claims/${d.ref}` : kind === 'penalty' ? `${base}/jobs/${d.ref}` : kind === 'codShortage' ? `${base}/finance/cod` : undefined
  return (
    <span className="text-caption">
      {label}
      {d.ref && (
        <>
          {' · '}
          {to ? (
            <Link to={to} className="tabular text-primary hover:underline">
              {d.ref}
            </Link>
          ) : (
            <span className="tabular">{d.ref}</span>
          )}
        </>
      )}
    </span>
  )
}
