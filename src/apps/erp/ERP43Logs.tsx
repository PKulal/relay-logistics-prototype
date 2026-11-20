/**
 * ERP-43 Audit log and AI decision log — docs/04-erp-control-tower.md.
 * Source §12 guardrails (every AI decision logged with its reason; models
 * reviewed monthly), §14 (audit logs). Export = CSV of the filtered rows.
 * Model review figures are seeded (INVENTED) until real monitoring exists.
 */
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { auditRows, brief, decisionRows, MODEL_REVIEWS, toCsv, type DecisionRow } from '@shared/engines/aiLog'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import type { AppKey, DemoData } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'

type Tab = 'audit' | 'ai' | 'models'
const APPS: AppKey[] = ['customer', 'partnerPortal', 'partnerApp', 'erp']
const LIMIT = 200

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Name of whoever did it, in any app. */
const whoIs = (data: DemoData, id: string) => data.staff[id]?.name ?? data.customerUsers[id]?.name ?? data.partnerUsers[id]?.name ?? data.fieldStaff[id]?.name ?? id

export default function ERP43Logs() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('audit')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp43.title')} subtitle={t('erp43.subtitle')} className="mb-0" />
      <div role="tablist" aria-label={t('erp43.title')} className="flex w-fit rounded-lg border bg-card p-0.5">
        {(['audit', 'ai', 'models'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md px-3 py-1 text-caption font-medium', tab === k && 'bg-primary text-primary-foreground')}>
            {t(`erp43.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'audit' && <Audit />}
      {tab === 'ai' && <Decisions />}
      {tab === 'models' && <Models />}
    </div>
  )
}

function Audit() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [app, setApp] = useState<AppKey | ''>('')
  const [q, setQ] = useState('')
  const rows = auditRows(data).filter((r) => (!app || r.app === app) && (!q.trim() || `${whoIs(data, r.userId)} ${r.action} ${r.recordId}`.toLowerCase().includes(q.toLowerCase())))
  const exportCsv = () =>
    download('audit-log.csv', toCsv([[t('erp43.col.time'), t('erp43.col.user'), t('erp43.col.app'), t('erp43.col.action'), t('erp43.col.record'), t('erp43.col.before'), t('erp43.col.after')], ...rows.map((r) => [r.at, whoIs(data, r.userId), r.app, r.action, r.recordId, brief(r.before), brief(r.after)])]))
  return (
    <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp43.tab.audit')}>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <NativeSelect aria-label={t('erp43.col.app')} value={app} onChange={(e) => setApp(e.target.value as AppKey | '')} className="w-44">
          <option value="">{t('erp43.allApps')}</option>
          {APPS.map((a) => (
            <option key={a} value={a}>
              {t(`erp43.app.${a}`)}
            </option>
          ))}
        </NativeSelect>
        <Input aria-label={t('erp43.search')} placeholder={t('erp43.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button variant="outline" size="sm" className="ml-auto" disabled={!rows.length} onClick={exportCsv}>
          <Download /> {t('erp43.export')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('erp43.noAudit')} className="m-4" />
      ) : (
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="audit">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp43.col.time')}</th>
              <th>{t('erp43.col.user')}</th>
              <th>{t('erp43.col.app')}</th>
              <th>{t('erp43.col.action')}</th>
              <th>{t('erp43.col.record')}</th>
              <th>{t('erp43.col.change')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LIMIT).map((r) => (
              <tr key={r.id} className="border-b align-top last:border-0">
                <td className="tabular px-4 py-1.5 whitespace-nowrap">{formatDateTime(r.at)}</td>
                <td>{whoIs(data, r.userId)}</td>
                <td className="text-caption">{t(`erp43.app.${r.app}`)}</td>
                <td className="tabular text-caption">{r.action}</td>
                <td className="tabular text-caption">{r.recordId}</td>
                <td className="max-w-80 text-caption break-all text-muted-foreground">
                  {r.before !== undefined && <span className="block">− {brief(r.before)}</span>}
                  {r.after !== undefined && <span className="block">+ {brief(r.after)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="px-4 py-3 text-caption text-muted-foreground">{t('erp43.showing', { shown: Math.min(rows.length, LIMIT), total: rows.length })}</p>
    </section>
  )
}

function Decisions() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [kind, setKind] = useState<DecisionRow['kind'] | ''>('')
  const rows = decisionRows(data).filter((r) => !kind || r.kind === kind)
  const decisionText = (r: DecisionRow) => (r.kind === 'legAssignment' ? t('erp43.d.assigned', { partner: r.decision.partner ?? '—' }) : r.kind === 'marginCheck' ? t(r.decision.belowTarget ? 'erp43.d.below' : 'erp43.d.ok', { pct: r.decision.grossPct }) : t('erp43.d.eta'))
  const reasonText = (r: DecisionRow) => (r.kind === 'legAssignment' ? t('erp43.r.assigned', { count: r.reason.candidates ?? 0, score: r.reason.score ?? '—' }) : r.kind === 'marginCheck' ? t('erp43.r.margin', { target: r.reason.targetPct }) : '—')
  const exportCsv = () =>
    download('ai-decisions.csv', toCsv([[t('erp43.col.time'), t('erp43.col.model'), t('erp43.col.record'), t('erp43.col.decision'), t('erp43.col.reason'), t('erp43.col.confidence'), t('erp43.col.accepted')], ...rows.map((r) => [r.at, r.model, r.record, decisionText(r), reasonText(r), `${Math.round(r.confidence * 100)}%`, r.acceptedBy ? whoIs(data, r.acceptedBy) : ''])]))
  return (
    <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp43.tab.ai')}>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <NativeSelect aria-label={t('erp43.col.model')} value={kind} onChange={(e) => setKind(e.target.value as DecisionRow['kind'] | '')} className="w-56">
          <option value="">{t('erp43.allModels')}</option>
          {(['legAssignment', 'marginCheck', 'etaPrediction'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`erp43.kind.${k}`)}
            </option>
          ))}
        </NativeSelect>
        <SimulatedTag />
        <Button variant="outline" size="sm" className="ml-auto" disabled={!rows.length} onClick={exportCsv}>
          <Download /> {t('erp43.export')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('erp43.noAi')} className="m-4" />
      ) : (
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="ai-log">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp43.col.time')}</th>
              <th>{t('erp43.col.model')}</th>
              <th>{t('erp43.col.record')}</th>
              <th>{t('erp43.col.decision')}</th>
              <th>{t('erp43.col.reason')}</th>
              <th>{t('erp43.col.confidence')}</th>
              <th>{t('erp43.col.accepted')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LIMIT).map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="tabular px-4 py-1.5 whitespace-nowrap">{formatDateTime(r.at)}</td>
                <td className="tabular text-caption whitespace-nowrap">{r.model}</td>
                <td className="tabular text-caption whitespace-nowrap">{r.record}</td>
                <td>{decisionText(r)}</td>
                <td className="text-caption text-muted-foreground">{reasonText(r)}</td>
                <td className="tabular">{Math.round(r.confidence * 100)}%</td>
                <td>{r.acceptedBy ? <Chip tone="success">{whoIs(data, r.acceptedBy)}</Chip> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="px-4 py-3 text-caption text-muted-foreground">{t('erp43.showing', { shown: Math.min(rows.length, LIMIT), total: rows.length })}</p>
    </section>
  )
}

function Models() {
  const { t } = useTranslation()
  const decisions = useData((d) => d.aiDecisions)
  const count = (kind: string) => Object.values(decisions).filter((d) => d.kind === kind).length
  return (
    <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp43.tab.models')}>
      <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="models">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="px-4 py-2">{t('erp43.col.model')}</th>
            <th>{t('erp43.col.logged')}</th>
            <th>{t('erp43.col.accuracy')}</th>
            <th>{t('erp43.col.fairness')}</th>
            <th>{t('erp43.col.nextReview')}</th>
          </tr>
        </thead>
        <tbody>
          {MODEL_REVIEWS.map((m) => (
            <tr key={m.model} className="border-b last:border-0">
              <td className="tabular px-4 py-2">{m.model}</td>
              <td className="tabular">{['legAssignment', 'marginCheck', 'etaPrediction'].includes(m.kind) ? count(m.kind) : '—'}</td>
              <td>{t(`erp43.m.${m.kind}.accuracy`)}</td>
              <td className="text-caption text-muted-foreground">{t(`erp43.m.${m.kind}.fairness`)}</td>
              <td className="tabular">{formatDate(m.nextReview)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-caption text-muted-foreground">{t('erp43.modelsNote')}</p>
    </section>
  )
}
