/**
 * ERP-30 Credit review — docs/04-erp-control-tower.md §6.8.
 * Source §6 Step 4 and §12 (credit-risk scoring): Finance sets the limit,
 * terms and deposit using the AI credit-risk score and its reasons; the
 * customer sees the decision on CP-07.
 */
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { suggestedCredit } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { CreditDecision } from '@shared/store/onboardingActions'
import type { Customer } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const TONE = { underReview: 'warning', approved: 'success', approvedLower: 'info', declined: 'danger' } as const

export default function ERP30CreditReview() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const apps = Object.values(data.customers)
    .filter((c) => c.onboarding?.credit)
    .sort((a, b) => b.onboarding!.credit!.submittedAt.localeCompare(a.onboarding!.credit!.submittedAt))
  const [openId, setOpenId] = useState<string>()
  const open = apps.find((c) => c.id === (openId ?? apps.find((a) => a.onboarding!.credit!.status === 'underReview')?.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp30.title')} subtitle={t('erp30.subtitle')} className="mb-0" />
      {apps.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('erp30.empty')}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <ul className="flex flex-col divide-y self-start rounded-xl border bg-card shadow-card">
            {apps.map((c) => {
              const a = c.onboarding!.credit!
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpenId(c.id)} aria-current={open?.id === c.id} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent aria-[current=true]:bg-primary-soft">
                    <span>
                      <span className="font-semibold">{c.legalName}</span>
                      <span className="tabular block text-caption text-muted-foreground">
                        {formatINR(a.requestedLimit)} · {t('cp07.days', { count: a.termsDays })} · {formatDateTime(a.submittedAt)}
                      </span>
                    </span>
                    <Chip tone={TONE[a.status]}>{t(`cp07.statusValue.${a.status}`)}</Chip>
                  </button>
                </li>
              )
            })}
          </ul>
          {open && <Decision key={open.id} c={open} />}
        </div>
      )}
    </div>
  )
}

function Decision({ c }: { c: Customer }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const a = c.onboarding!.credit!
  const suggestion = suggestedCredit(a.score, a.requestedLimit)
  const [limit, setLimit] = useState(String(suggestion.status === 'declined' ? a.requestedLimit : suggestion.limit))
  const [terms, setTerms] = useState<15 | 30 | 45>(a.termsDays)
  const [deposit, setDeposit] = useState(String(suggestion.deposit || Math.round(a.requestedLimit / 10)))
  const [remarks, setRemarks] = useState('')
  const canDecide = user.role === 'finance' && a.status === 'underReview'
  const risk = a.score >= 70 ? 'low' : a.score >= 50 ? 'medium' : 'high'

  const decide = (status: CreditDecision['status']) => {
    const lim = Number(limit)
    if (status !== 'declined' && !(lim > 0)) return toast.error(t('erp30.err.limit'))
    if (status === 'approvedLower' && lim >= a.requestedLimit) return toast.error(t('erp30.err.lower'))
    useDemoStore.getState().decideCredit(c.id, { status, limit: status === 'approved' ? a.requestedLimit : lim, termsDays: terms, deposit: Number(deposit) || 0, remarks }, user.id)
    toast.success(t('erp30.decided', { status: t(`cp07.statusValue.${status}`) }))
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="dec-h">
      <h2 id="dec-h" className="text-card-title">
        {c.legalName}
      </h2>
      <div className="flex items-start gap-4 rounded-lg bg-gray-50 p-4">
        <div className="text-center">
          <p className="tabular font-heading text-page-title font-bold" data-testid="credit-score">
            {a.score}
          </p>
          <Chip tone={risk === 'low' ? 'success' : risk === 'medium' ? 'warning' : 'danger'}>{t(`erp30.risk.${risk}`)}</Chip>
        </div>
        <div className="flex-1">
          <p className="mb-1 flex items-center gap-1 font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden /> {t('erp30.score')} <SimulatedTag />
          </p>
          <ul className="text-caption">
            {a.scoreReasons.map((r) => {
              const [key, pts] = r.split(':')
              return (
                <li key={key} className="tabular">
                  {t(`credit.reason.${key}`)} · +{pts}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <p className="tabular">
        {t('erp30.requested', { limit: formatINR(a.requestedLimit), days: a.termsDays })} · {t('erp30.years', { count: a.yearsInBusiness })} · {a.depositWilling ? t('erp30.depositYes') : t('erp30.depositNo')}
      </p>

      {a.status === 'underReview' ? (
        <>
          <p className="text-caption text-muted-foreground">{t('erp30.suggestion', { status: t(`cp07.statusValue.${suggestion.status}`), limit: formatINR(suggestion.limit) })}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('erp30.limit')} htmlFor="d-limit" required>
              <Input id="d-limit" type="number" min={0} step={5000} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canDecide} />
            </Field>
            <Field label={t('cp07.terms')} htmlFor="d-terms" required>
              <NativeSelect id="d-terms" value={terms} onChange={(e) => setTerms(Number(e.target.value) as 15 | 30 | 45)} disabled={!canDecide}>
                {[15, 30, 45].map((d) => (
                  <option key={d} value={d}>
                    {t('cp07.days', { count: d })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('cp07.depositAmount')} htmlFor="d-dep">
              <Input id="d-dep" type="number" min={0} step={5000} value={deposit} onChange={(e) => setDeposit(e.target.value)} disabled={!canDecide} />
            </Field>
            <Field label={t('cp07.remarks')} htmlFor="d-rem" className="sm:col-span-3">
              <Input id="d-rem" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!canDecide} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canDecide} onClick={() => decide('approved')}>
              {t('erp30.approve')}
            </Button>
            <Button variant="outline" disabled={!canDecide} onClick={() => decide('approvedLower')}>
              {t('erp30.approveLower')}
            </Button>
            <Button variant="outline" disabled={!canDecide} onClick={() => decide('declined')} className="text-status-danger">
              {t('erp30.decline')}
            </Button>
          </div>
          {user.role !== 'finance' && <p className="text-caption text-muted-foreground">{t('erp30.financeOnly')}</p>}
        </>
      ) : (
        <p className="tabular">
          <Chip tone={TONE[a.status]}>{t(`cp07.statusValue.${a.status}`)}</Chip> {formatINR(a.approvedLimit ?? 0)} · {t('cp07.days', { count: a.approvedTerms ?? a.termsDays })} · {t('cp07.depositAmount')} {formatINR(a.deposit ?? 0)} ·{' '}
          {a.decidedBy === 'system' ? t('erp27.automatic') : data.staff[a.decidedBy ?? '']?.name}
          {a.accepted ? ` · ${t('erp30.acceptedByCustomer')}` : ''}
        </p>
      )}
    </section>
  )
}
