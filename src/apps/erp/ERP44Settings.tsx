/**
 * ERP-44 System settings — docs/04-erp-control-tower.md. Source §14
 * ("configurable for rule changes"; tax rules configurable), §8 e-way bill
 * limits. Super Admin edits; department heads view. Save takes effect at once
 * in all four apps and is logged (ERP-43). Only values the engines read are
 * listed; the pickup cut-off and leg windows change through ERP-20
 * (maker-checker).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { EditableSetting, SettingsPatch } from '@shared/store/adminActions'
import type { Settings } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { useErpSession } from './useErpSession'

const GROUPS: { key: string; fields: EditableSetting[] }[] = [
  { key: 'compliance', fields: ['ewayBillThreshold', 'ewayBillKmPerDay'] },
  { key: 'pricing', fields: ['volumetricDivisor', 'cftFactor', 'targetMarginPct', 'riskBufferPct'] },
  { key: 'operations', fields: ['partnerAcceptanceMinutes', 'arrivalGeofenceM', 'weightTolerancePct', 'weightToleranceKg', 'ndrMaxAttempts'] },
  { key: 'finance', fields: ['codDepositHours', 'codRemittanceDays', 'partnerDisputeSlaHours', 'earlyPayFeePct', 'gstPct'] },
  { key: 'claims', fields: ['claimSettlementDays', 'claimWindowDays'] },
  { key: 'partners', fields: ['trialPassMark', 'probationVolumeCutPct'] },
]
const BANDS = ['platinum', 'gold', 'silver', 'bronze'] as const

export default function ERP44Settings() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const settings = useData((d) => d.settings)
  const canEdit = user.role === 'superAdmin'
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [bands, setBands] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string>()
  const val = (k: EditableSetting) => draft[k] ?? String(settings[k])
  const bandVal = (k: (typeof BANDS)[number]) => bands[k] ?? String(settings.tierBands[k])
  const dirty = Object.keys(draft).some((k) => draft[k] !== String(settings[k as keyof Settings])) || BANDS.some((k) => bands[k] !== undefined && bands[k] !== String(settings.tierBands[k]))

  const save = () => {
    const patch: SettingsPatch = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)]))
    if (BANDS.some((k) => bands[k] !== undefined)) patch.tierBands = Object.fromEntries(BANDS.map((k) => [k, Number(bandVal(k))])) as Settings['tierBands']
    const r = useDemoStore.getState().updateSettings(patch, user.id)
    if (r.error) return setErr(r.error.reason === 'order' ? t('erp44.err.order') : t('erp44.err.range', { field: t(`erp44.f.${r.error.field}`) }))
    setErr(undefined)
    setDraft({})
    setBands({})
    toast.success(t('erp44.saved'))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp44.title')}
        subtitle={canEdit ? t('erp44.subtitle') : t('erp44.viewOnly')}
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" disabled={!dirty} onClick={() => (setDraft({}), setBands({}), setErr(undefined))}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!dirty} onClick={save}>
                {t('common.save')}
              </Button>
            </div>
          )
        }
        className="mb-0"
      />
      {err && (
        <p role="alert" className="text-caption font-medium text-status-danger">
          {err}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.key} className="rounded-xl border bg-card p-5 shadow-card" aria-label={t(`erp44.g.${g.key}`)}>
            <h2 className="mb-3 font-heading text-section font-semibold">{t(`erp44.g.${g.key}`)}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-caption font-medium">{t(`erp44.f.${k}`)}</span>
                  <Input inputMode="decimal" value={val(k)} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, [k]: e.target.value.replace(/[^\d.]/g, '') })} className="tabular" />
                </label>
              ))}
              {g.key === 'partners' &&
                BANDS.map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-caption font-medium">{t(`erp44.band.${k}`)}</span>
                    <Input inputMode="numeric" value={bandVal(k)} disabled={!canEdit} onChange={(e) => setBands({ ...bands, [k]: e.target.value.replace(/\D/g, '') })} className="tabular" />
                  </label>
                ))}
            </div>
            {g.key === 'operations' && (
              <p className="mt-3 text-caption text-muted-foreground">
                {t('erp44.windows', { cutoff: settings.pickupCutoff })}{' '}
                <Link to="/erp/network/rules" className="text-primary hover:underline">
                  {t('erp44.toLegRules')}
                </Link>
              </p>
            )}
          </section>
        ))}
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp44.g.language')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp44.g.language')}</h2>
          <p>English · हिन्दी</p>
          <p className="text-caption text-muted-foreground">{t('erp44.languageNote')}</p>
        </section>
      </div>
    </div>
  )
}
