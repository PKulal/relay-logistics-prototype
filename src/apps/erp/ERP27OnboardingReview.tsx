/**
 * ERP-27 Customer onboarding review — docs/04-erp-control-tower.md §6.7.
 * Source §6 Phases 1–3: qualification, the AI lane-cost preview (Logisco
 * only), the track and the KYC results; Sales clears a flagged KYC. Rate card,
 * contract issue, pilot plan and Mark live come with Part 3b.
 */
import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { laneMargin, laneVerdict } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { CheckState, Customer, CustomerTrack } from '@shared/types'
import { Button } from '@shared/ui/button'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const TRACKS: CustomerTrack[] = ['selfServe', 'insideSales', 'kam', 'kamSolutions', 'apiOndc']

export default function ERP27OnboardingReview() {
  const { customerId } = useParams()
  return customerId ? <Review customerId={customerId} /> : <OnboardingList />
}

function OnboardingList() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const rows = Object.values(data.customers)
    .filter((c) => c.onboarding)
    .sort((a, b) => b.onboarding!.createdAt.localeCompare(a.onboarding!.createdAt))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp27.title')} subtitle={t('erp27.subtitle')} className="mb-0" />
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('erp27.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to={`/erp/sales/onboarding/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-accent">
                <span>
                  <span className="font-semibold">{c.legalName}</span>
                  <span className="tabular block text-caption text-muted-foreground">
                    {c.gstin} · {t(`customerType.${c.type}`)} · {t(`track.${c.track}`)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {c.onboarding?.kyc?.status === 'underReview' && <Chip tone="warning">{t('erp27.kycReview')}</Chip>}
                  <Chip tone="info">{t(`customerStatus.${c.status}`)}</Chip>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Review({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const c: Customer | undefined = data.customers[customerId]
  if (!c?.onboarding) return <NotFound />
  const q = c.onboarding.qualification
  const k = c.onboarding.kyc
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === c.id)
  const canEdit = user.role === 'sales'

  return (
    <div className="flex flex-col gap-4">
      <Link to="/erp/sales/onboarding" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('erp27.back')}
      </Link>
      <PageHeader title={c.legalName} subtitle={`${c.gstin} · ${t(`customerType.${c.type}`)} · ${t(`customerStatus.${c.status}`)}`} className="mb-0" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="q-h">
          <h2 id="q-h" className="mb-2 text-card-title">
            {t('erp27.qualification')}
          </h2>
          {!q ? (
            <p className="text-muted-foreground">{t('erp27.notQualified')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>{t('erp27.volume', { count: q.shipmentsPerMonth, spend: t(`cp05.spendBand.${q.spendBand}`) })}</li>
              <li>{t('cp05.mixValue', { parcel: q.parcelPct, ptl: 100 - q.parcelPct })}</li>
              <li>
                {t('cp05.handling')}: {q.specialHandling.length ? q.specialHandling.map((h) => t(`cp05.handlingOpt.${h}`)).join(', ') : '—'}
              </li>
              <li>
                {t('cp05.payment')}: {q.payment.map((p) => t(`cp05.paymentOpt.${p}`)).join(', ')}
              </li>
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="t-h">
          <h2 id="t-h" className="text-card-title">
            {t('erp27.track')}
          </h2>
          <NativeSelect aria-label={t('erp27.track')} value={c.track} disabled={!canEdit} onChange={(e) => (useDemoStore.getState().setTrack(c.id, e.target.value as CustomerTrack, user.id), toast.success(t('erp27.trackSet')))}>
            {TRACKS.map((tr) => (
              <option key={tr} value={tr}>
                {t(`track.${tr}`)}
              </option>
            ))}
          </NativeSelect>
          <p className="text-caption text-muted-foreground">
            {t('erp27.billing', { billing: t(`erp27.billingValue.${c.billing}`) })} · {t('erp27.kam', { name: c.kamId ? data.staff[c.kamId]?.name : '—' })}
          </p>
        </section>
      </div>

      {q && (
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="lc-h">
          <h2 id="lc-h" className="mb-2 flex items-center gap-2 text-card-title">
            <Sparkles className="size-4 text-primary" aria-hidden /> {t('erp27.laneCost')} <SimulatedTag />
          </h2>
          <table className="w-full text-table" data-testid="lane-cost">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp27.lane')}</th>
                <th>{t('erp27.perMonth')}</th>
                <th>{t('erp27.serviceable')}</th>
                <th>{t('erp27.sampleCol')}</th>
                <th className="text-right">{t('erp27.margin')}</th>
              </tr>
            </thead>
            <tbody>
              {q.lanes.map((l, i) => {
                const v = laneVerdict(data, l.originPincode, l.destCity)
                const m = laneMargin(data, l.originPincode, l.destCity, q.parcelPct)
                const o = data.pincodes[l.originPincode]
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">
                      {o ? o.city : l.originPincode} → {l.destCity === '__other' ? t('cp05.otherCity') : l.destCity}
                    </td>
                    <td className="tabular">{l.perMonth}</td>
                    <td>{t(`cp05.verdict.${v}`)}</td>
                    <td className="text-caption">{m ? t(`erp27.sample.${m.sample}`) : '—'}</td>
                    <td className={m?.belowTarget ? 'tabular text-right font-semibold text-status-danger' : 'tabular text-right'}>{m ? `${m.marginPct.toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-caption text-muted-foreground">{t('erp27.laneCostNote', { target: data.settings.targetMarginPct })}</p>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="k-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="k-h" className="text-card-title">
            {t('erp27.kyc')}
          </h2>
          {k && <Chip tone={k.status === 'verified' ? 'success' : k.status === 'underReview' ? 'warning' : 'neutral'}>{t(`erp27.kycStatus.${k.status}`)}</Chip>}
        </div>
        {!k ? (
          <p className="text-muted-foreground">{t('erp27.kycNotStarted')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="kyc-checks">
            <Check label={t('erp27.check.gstin')} state={k.gstin.state} detail={k.gstin.registeredOn ? `${k.gstin.active ? t('cp06.active') : t('cp06.cancelled')} · ${formatDate(k.gstin.registeredOn)}` : undefined} />
            <Check label={t('erp27.check.pan')} state={k.pan.state} detail={k.pan.value} />
            <Check label={t('erp27.check.cin')} state={k.cin ? 'verified' : c.entityType === 'Private Ltd' || c.entityType === 'Public Ltd' ? 'notStarted' : 'verified'} detail={k.cin ?? t('erp27.notNeeded')} />
            <Check label={t('erp27.check.bank')} state={k.bank.state} detail={k.bank.bankName ? `${k.bank.bankName} · ${t('erp27.match', { pct: k.bank.matchPct })}` : undefined} />
            <Check label={t('erp27.check.signatory')} state={k.signatory ? 'verified' : 'notStarted'} detail={k.signatory ? `${k.signatory.name}, ${k.signatory.designation}` : undefined} />
            <Check label={t('erp27.check.addresses')} state={locations.length ? 'verified' : 'notStarted'} detail={t('erp27.locations', { count: locations.length })} />
          </ul>
        )}
        {k?.status === 'underReview' && (
          <Button className="self-start" disabled={!canEdit} onClick={() => (useDemoStore.getState().clearKyc(c.id, user.id), toast.success(t('erp27.cleared')))}>
            {t('erp27.clear')}
          </Button>
        )}
        {k?.reviewedBy && <p className="text-caption text-muted-foreground">{t('erp27.reviewedBy', { name: k.reviewedBy === 'system' ? t('erp27.automatic') : data.staff[k.reviewedBy]?.name })}</p>}
      </section>

      <p className="text-caption text-muted-foreground">{t('erp27.later')}</p>
    </div>
  )
}

function Check({ label, state, detail }: { label: string; state: CheckState; detail?: string }) {
  const Icon = state === 'verified' ? CheckCircle2 : state === 'flagged' ? CircleAlert : CircleDashed
  return (
    <li className="flex items-start gap-2">
      <Icon className={state === 'verified' ? 'mt-0.5 size-4 text-status-success' : state === 'flagged' ? 'mt-0.5 size-4 text-status-warning' : 'mt-0.5 size-4 text-muted-foreground'} aria-hidden />
      <span>
        <span className="font-medium">{label}</span>
        {detail && <span className="tabular block text-caption text-muted-foreground">{detail}</span>}
      </span>
    </li>
  )
}
