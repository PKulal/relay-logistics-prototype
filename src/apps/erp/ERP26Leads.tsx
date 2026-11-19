/**
 * ERP-26 Leads and pipeline — docs/04-erp-control-tower.md §6.7.
 * Source §6 Phase 1 and §11 Sales ("CRM, leads; lead scoring"): every lead
 * with its source and AI lead score, by onboarding stage. Assign an owner,
 * move a stage, log a call / visit / email.
 */
import { ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { INDUSTRIES } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { LEAD_STAGES, type Lead, type LeadSource, type LeadStage } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@shared/ui/sheet'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const SOURCES: LeadSource[] = ['website', 'salesVisit', 'referral', 'ondc', 'tender', 'partnerReferral']

export default function ERP26Leads() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [f, setF] = useState({ source: '', owner: '', industry: '' })
  const [openId, setOpenId] = useState<string>()
  const sales = Object.values(data.staff).filter((s) => s.role === 'sales')
  const leads = Object.values(data.leads).filter((l) => (!f.source || l.source === f.source) && (!f.owner || l.ownerId === f.owner) && (!f.industry || l.industry === f.industry))
  const open = openId ? data.leads[openId] : undefined

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp26.title')} subtitle={t('erp26.subtitle', { count: Object.keys(data.leads).length })} className="mb-0" />
      <div className="grid gap-2 sm:grid-cols-3" aria-label={t('erp26.filters')}>
        <NativeSelect aria-label={t('erp26.source')} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
          <option value="">{t('erp26.allSources')}</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {t(`leadSource.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('erp26.owner')} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
          <option value="">{t('erp26.allOwners')}</option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('erp26.industry')} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}>
          <option value="">{t('erp26.allIndustries')}</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {t(`industry.${i}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {Object.keys(data.leads).length === 0 && <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('erp26.empty')}</p>}

      {/* Kanban by onboarding stage */}
      <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-8" role="list" aria-label={t('erp26.board')}>
        {LEAD_STAGES.map((stage) => {
          const cards = leads.filter((l) => l.stage === stage)
          return (
            <section key={stage} role="listitem" aria-labelledby={`col-${stage}`} className="flex min-w-48 flex-col gap-2 rounded-xl bg-gray-50 p-2">
              <h2 id={`col-${stage}`} className="flex items-center justify-between px-1 text-caption font-semibold text-muted-foreground uppercase">
                {t(`erp26.stage.${stage}`)} <span className="tabular">{cards.length}</span>
              </h2>
              {cards.map((l) => (
                <button key={l.id} type="button" onClick={() => setOpenId(l.id)} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-left shadow-card hover:border-primary">
                  <span className="font-semibold">{l.company}</span>
                  <span className="text-caption text-muted-foreground">
                    {t(`leadSource.${l.source}`)}
                    {l.declaredVolume ? ` · ${t('erp26.perMonth', { count: l.declaredVolume })}` : ''}
                  </span>
                  <span className="flex items-center justify-between gap-1 text-caption">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Sparkles className="size-3" aria-hidden /> {l.aiScore}
                    </span>
                    <span className="text-muted-foreground">{l.ownerId ? data.staff[l.ownerId]?.name.split(' ')[0] : t('erp26.unassigned')}</span>
                  </span>
                </button>
              ))}
            </section>
          )
        })}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">{open && <LeadPanel lead={open} by={user.id} onDone={() => setOpenId(undefined)} />}</SheetContent>
      </Sheet>
    </div>
  )
}

function LeadPanel({ lead, by, onDone }: { lead: Lead; by: string; onDone: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const store = useDemoStore.getState
  const [kind, setKind] = useState<'call' | 'visit' | 'email'>('call')
  const [note, setNote] = useState('')
  const sales = Object.values(data.staff).filter((s) => s.role === 'sales')
  return (
    <div className="flex flex-col gap-4">
      <SheetHeader className="p-0">
        <SheetTitle>{lead.company}</SheetTitle>
      </SheetHeader>
      <dl className="grid grid-cols-2 gap-2 text-body">
        <div>
          <dt className="text-caption text-muted-foreground">{t('erp26.gstin')}</dt>
          <dd className="tabular">{lead.gstin}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('erp26.source')}</dt>
          <dd>{t(`leadSource.${lead.source}`)}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('erp26.type')}</dt>
          <dd>
            {t(`customerType.${lead.businessType}`)} · {t(`industry.${lead.industry}`)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('erp26.score')}</dt>
          <dd className="flex items-center gap-1 font-semibold">
            {lead.aiScore} <SimulatedTag />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-caption text-muted-foreground">{t('erp26.contact')}</dt>
          <dd>
            {lead.contact.name} · {lead.contact.email} · {lead.contact.mobile}
          </dd>
        </div>
      </dl>

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium">{t('erp26.owner')}</span>
        <NativeSelect value={lead.ownerId ?? ''} onChange={(e) => (store().assignLead(lead.id, e.target.value, by), toast.success(t('erp26.assigned')))}>
          <option value="" disabled>
            {t('erp26.unassigned')}
          </option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.title}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium">{t('erp26.moveStage')}</span>
        <NativeSelect value={lead.stage} onChange={(e) => store().moveLead(lead.id, e.target.value as LeadStage, by)}>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`erp26.stage.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </label>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('erp26.logActivity')}</h3>
        <div className="flex gap-2">
          <NativeSelect aria-label={t('erp26.activityKind')} value={kind} onChange={(e) => setKind(e.target.value as 'call' | 'visit' | 'email')} className="w-28">
            {(['call', 'visit', 'email'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`erp26.kind.${k}`)}
              </option>
            ))}
          </NativeSelect>
          <Input aria-label={t('erp26.note')} placeholder={t('erp26.note')} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={!note.trim()} onClick={() => (store().logLeadActivity(lead.id, kind, note, by), setNote(''))}>
            {t('erp26.add')}
          </Button>
        </div>
        <ol className="flex flex-col gap-2">
          {[...lead.activities].reverse().map((a, i) => (
            <li key={i} className="text-caption">
              <span className={cn('font-semibold', a.kind === 'stage' && 'text-primary')}>{t(`erp26.kind.${a.kind}`)}</span> · {a.note}
              <span className="block text-muted-foreground">
                {formatDateTime(a.at)} · {data.staff[a.by]?.name ?? data.customerUsers[a.by]?.name ?? t('erp26.system')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {lead.customerId && (
        <Link to={`/erp/sales/onboarding/${lead.customerId}`} onClick={onDone} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          {t('erp26.openReview')} <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
      <Chip tone="neutral" className="self-start">
        {lead.id}
      </Chip>
    </div>
  )
}
