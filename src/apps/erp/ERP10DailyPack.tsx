/**
 * ERP-10 Daily review pack — docs/04-erp-control-tower.md §6.3.
 * Source §11.1 "Daily Review Pack: auto-generated at 9 am". The summary is
 * SIMULATED AI text built from the numbers.
 */
import { Bot, Mail, Printer } from 'lucide-react'
import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { dailyPack, type DailyPack, type PartnerLeague } from '@shared/engines/opsReview'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import type { DemoData, ExceptionKind } from '@shared/types'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { PrintArea } from '@shared/ui/PrintArea'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

/** SIMULATED AI summary: plain sentences from the pack's numbers. */
export function packSummary(t: TFunction, data: DemoData, p: DailyPack): string {
  const open = Object.values(p.carriedOver).reduce((a, n) => a + (n ?? 0), 0)
  const worst = p.worst[0]
  return [
    t('erp10.ai.delivered', { n: p.delivered, pct: p.onTimePct }),
    open ? t('erp10.ai.open', { n: open }) : t('erp10.ai.noOpen'),
    worst ? t('erp10.ai.worst', { name: data.partners[worst.partnerId].shortName, pct: worst.onTimePct }) : '',
    p.stopped ? t('erp10.ai.stopped', { n: p.stopped }) : '',
    p.hubsOverDwell.length ? t('erp10.ai.dwell', { hubs: p.hubsOverDwell.map((h) => data.hubs[h].name).join(', ') }) : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export default function ERP10DailyPack() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const pack = useMemo(() => dailyPack(data, now), [data, now])
  // SIMULATED: email to the ops group
  const email = () => toast.success(t('erp10.emailed'))
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title={t('erp10.title', { date: formatDate(pack.date) })}
        subtitle={t('erp10.generated', { at: formatDateTime(pack.generatedAt) })}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('erp10.print')}
            </Button>
            <Button variant="outline" onClick={email}>
              <Mail /> {t('erp10.email')} <SimulatedTag />
            </Button>
          </div>
        }
        className="mb-0"
      />
      <PackBody pack={pack} />
      <PrintArea>
        <div className="p-8">
          <h1 className="mb-4 text-section font-bold">{t('erp10.title', { date: formatDate(pack.date) })}</h1>
          <PackBody pack={pack} />
        </div>
      </PrintArea>
    </div>
  )
}

function PackBody({ pack }: { pack: DailyPack }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const types = (m: Partial<Record<ExceptionKind, number>>) =>
    Object.entries(m).length ? (Object.entries(m) as [ExceptionKind, number][]).map(([k, n]) => `${t(`cp19.type.${k}`)} ${n}`).join(' · ') : t('erp10.none')
  const league = (rows: PartnerLeague[]) => (
    <table className="w-full text-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.partnerId} className="tabular border-b last:border-0">
            <td className="py-1">{data.partners[r.partnerId].shortName}</td>
            <td className="text-right">{t('erp10.legs', { n: r.legs })}</td>
            <td className="w-16 text-right font-semibold">{r.onTimePct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="flex flex-col gap-4" data-testid="pack">
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ai-h">
        <h2 id="ai-h" className="flex items-center gap-2 font-semibold">
          <Bot className="size-4" aria-hidden /> {t('erp10.summary')} <SimulatedTag />
        </h2>
        <p data-testid="ai-summary">{packSummary(t, data, pack)}</p>
      </section>
      <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-4" aria-label={t('erp10.yesterday')}>
        <h2 className="font-semibold sm:col-span-4">{t('erp10.yesterday')}</h2>
        <Kpi label={t('erp10.booked')} value={pack.booked} />
        <Kpi label={t('erp10.delivered')} value={pack.delivered} />
        <Kpi label={t('erp10.onTime')} value={`${pack.onTimePct}%`} />
        <Kpi label={t('erp10.claims')} value={pack.claims} />
        <p className="text-table sm:col-span-4">
          <span className="font-medium">{t('erp10.exceptions')}:</span> {types(pack.exceptions)}
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp10.best')}>
          <h2 className="mb-2 font-semibold">{t('erp10.best')}</h2>
          {league(pack.best)}
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp10.worst')}>
          <h2 className="mb-2 font-semibold">{t('erp10.worst')}</h2>
          {league(pack.worst)}
        </section>
      </div>
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp10.risks')}>
        <h2 className="font-semibold">{t('erp10.risks')}</h2>
        <p>
          <span className="font-medium">{t('erp10.carried')}:</span> {types(pack.carriedOver)}
        </p>
        <p>
          <span className="font-medium">{t('erp10.stopped')}:</span> {pack.stopped}
        </p>
        <p>
          <span className="font-medium">{t('erp10.dwell')}:</span> {pack.hubsOverDwell.length ? pack.hubsOverDwell.map((h) => data.hubs[h].name).join(', ') : t('erp10.none')}
        </p>
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="tabular text-section font-semibold">{value}</p>
    </div>
  )
}
