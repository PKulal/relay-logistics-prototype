/**
 * CP-07 Credit application and status — docs/01-customer-portal.md §6.1.
 * Source §6 Step 4 (credit customers only): limit, terms, deposit / bank
 * guarantee; Logisco's AI credit-risk score is used by Finance (ERP-30) and
 * never shown here. SME accounts start on prepaid (source §6 table).
 */
import { ArrowRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useDemoNow } from '@shared/hooks/useDemo'
import { formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { businessAge } from '@shared/store/onboardingActions'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

const TONE = { underReview: 'warning', approved: 'success', approvedLower: 'info', declined: 'danger' } as const

export default function CP07Credit() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer: c } = useCustomerSession()
  const now = useDemoNow()
  const app = c.onboarding?.credit
  const [limit, setLimit] = useState('')
  const [terms, setTerms] = useState<15 | 30 | 45>(30)
  const [years, setYears] = useState(() => String(businessAge(useDemoStore.getState().data, c.id, now) || ''))
  const [consent, setConsent] = useState(c.onboarding?.gstConsent ?? false)
  const [deposit, setDeposit] = useState<'yes' | 'no' | ''>('')
  const [tried, setTried] = useState(false)
  const canApply = user.role === 'admin' || user.role === 'finance'

  if (c.billing !== 'credit' && !app) {
    return (
      <div className="max-w-3xl">
        <OnboardingSteps customer={c} current="credit" />
        <PageHeader title={t('cp07.title')} />
        <p className="rounded-xl border bg-card p-6">{t('cp07.prepaid')}</p>
      </div>
    )
  }

  const errors = {
    limit: !(Number(limit) >= 25000) ? t('cp07.err.limit') : undefined,
    years: !(Number(years) >= 0 && years !== '') ? t('cp05.err.positive') : undefined,
    consent: !consent ? t('cp07.err.consent') : undefined,
    deposit: !deposit ? t('cp04.err.required') : undefined,
  }
  const valid = Object.values(errors).every((e) => !e)
  const submit = () => {
    setTried(true)
    if (!valid) return
    useDemoStore.getState().submitCredit(c.id, { requestedLimit: Number(limit), termsDays: terms, yearsInBusiness: Number(years), gstConsent: consent, depositWilling: deposit === 'yes' }, user.id)
    toast.success(t('cp07.submitted'))
  }

  return (
    <div className="max-w-3xl">
      <OnboardingSteps customer={c} current="credit" />
      <PageHeader title={t('cp07.title')} subtitle={t('cp07.subtitle')} />

      {!app ? (
        <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2">
          <Field label={t('cp07.limit')} htmlFor="cr-limit" required error={tried ? errors.limit : undefined} hint={t('cp07.limitHint')}>
            <Input id="cr-limit" type="number" min={25000} step={5000} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <Field label={t('cp07.terms')} htmlFor="cr-terms" required>
            <NativeSelect id="cr-terms" value={terms} onChange={(e) => setTerms(Number(e.target.value) as 15 | 30 | 45)}>
              {[15, 30, 45].map((d) => (
                <option key={d} value={d}>
                  {t('cp07.days', { count: d })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp07.years')} htmlFor="cr-years" required error={tried ? errors.years : undefined} hint={t('cp07.yearsHint')}>
            <Input id="cr-years" type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-caption font-medium">
              {t('cp07.deposit')} <span className="text-status-danger">*</span>
            </legend>
            <RadioGroup value={deposit} onValueChange={(v) => setDeposit(v as 'yes' | 'no')} className="flex gap-4" aria-label={t('cp07.deposit')}>
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} /> {t(`cp07.depositOpt.${v}`)}
                </label>
              ))}
            </RadioGroup>
            {tried && errors.deposit && <p className="text-caption font-medium text-status-danger">{errors.deposit}</p>}
          </fieldset>
          <label className="flex items-start gap-2 sm:col-span-2">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>{t('cp07.consent')}</span>
          </label>
          {tried && errors.consent && <p className="text-caption font-medium text-status-danger sm:col-span-2">{errors.consent}</p>}
          <Button className="self-start" disabled={!canApply} onClick={submit}>
            {t('cp07.submit')}
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card" aria-live="polite" data-testid="credit-decision">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-card-title">{t('cp07.status')}</span>
            <Chip tone={TONE[app.status]}>{t(`cp07.statusValue.${app.status}`)}</Chip>
          </div>
          {app.status === 'underReview' ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" aria-hidden /> {t('cp07.reviewing', { limit: formatINR(app.requestedLimit), days: app.termsDays })}
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-caption text-muted-foreground">{t('cp07.approvedLimit')}</dt>
                <dd className="tabular font-heading text-section font-bold">{formatINR(app.approvedLimit ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">{t('cp07.terms')}</dt>
                <dd className="font-medium">{app.status === 'declined' ? '—' : t('cp07.fromInvoice', { count: app.approvedTerms })}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">{t('cp07.depositAmount')}</dt>
                <dd className="tabular font-medium">{formatINR(app.deposit ?? 0)}</dd>
              </div>
              {app.remarks && (
                <div className="sm:col-span-3">
                  <dt className="text-caption text-muted-foreground">{t('cp07.remarks')}</dt>
                  <dd>{app.remarks}</dd>
                </div>
              )}
            </dl>
          )}
          {app.status !== 'underReview' && !app.accepted && (
            <Button className="self-start" disabled={!canApply} onClick={() => (useDemoStore.getState().acceptCredit(c.id, user.id), toast.success(app.status === 'declined' ? t('cp07.onPrepaid') : t('cp07.accepted')))}>
              {app.status === 'declined' ? t('cp07.continuePrepaid') : t('cp07.accept')}
            </Button>
          )}
          {app.accepted && (
            <Button className="self-start" onClick={() => navigate('/customer/onboarding/next')}>
              {t('cp06.continue')} <ArrowRight />
            </Button>
          )}
        </section>
      )}
    </div>
  )
}
