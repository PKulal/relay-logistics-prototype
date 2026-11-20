/**
 * ERP-45 Placeholder department page — docs/04-erp-control-tower.md. One
 * template for the five departments planned for a later phase, with their
 * modules and AI features from the client's department table (source §11).
 */
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'

const DEPARTMENTS = ['marketing', 'quality', 'hr', 'procurement', 'sustainability'] as const

export default function ERP45Department() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const key = DEPARTMENTS.find((d) => pathname.split('/').includes(d)) ?? 'marketing'
  const list = (k: 'modules' | 'ai') => t(`erp45.d.${key}.${k}`).split(' · ')
  return (
    <div className="flex max-w-3xl flex-col gap-4" data-testid="department">
      <PageHeader title={t(`erp45.d.${key}.name`)} subtitle={t(`erp45.d.${key}.group`)} actions={<Chip tone="neutral">{t('erp45.status')}</Chip>} className="mb-0" />
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 font-heading text-section font-semibold">{t('erp45.modules')}</h2>
        <ul className="list-disc pl-5">
          {list('modules').map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
          <Sparkles className="size-5 text-muted-foreground" aria-hidden /> {t('erp45.ai')}
        </h2>
        <ul className="list-disc pl-5">
          {list('ai').map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
      <p className="text-caption text-muted-foreground">{t('erp45.note')}</p>
    </div>
  )
}
