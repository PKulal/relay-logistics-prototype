/**
 * CP-34 Preferences — docs/01-customer-portal.md. Source §14 (Hindi + English:
 * the user picks the language) and §13 / §9 (WhatsApp messages to consignees:
 * tracking, appointment, NDR, delivery). The per-event channel matrix is not
 * built (no basis in the client document).
 */
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Switch } from '@shared/ui/switch'
import { Field } from '@shared/ui/FormField'
import { useCustomerSession } from './useCustomerSession'

export default function CP34Preferences() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const on = useData((d) => d.customers[customer.id].consigneeMessages ?? true)
  const setLanguage = useSession((s) => s.setLanguage)

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={t('cp34.title')} subtitle={t('cp34.subtitle')} className="mb-0" />
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp34.language')}>
        <Field label={t('cp34.language')} htmlFor="p-lang" hint={t('cp34.languageHint')}>
          <NativeSelect
            id="p-lang"
            value={user.language}
            onChange={(e) => {
              const lang = e.target.value as 'en' | 'hi'
              useDemoStore.getState().setUserLanguage(user.id, lang)
              setLanguage(lang)
              toast.success(t('cp34.saved'))
            }}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </NativeSelect>
        </Field>
      </section>
      {user.role === 'admin' && (
        <section className="flex items-start justify-between gap-4 rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp34.consignee')}>
          <div>
            <h2 className="font-heading font-semibold">{t('cp34.consignee')}</h2>
            <p className="text-caption text-muted-foreground">{t('cp34.consigneeBody')}</p>
          </div>
          <Switch checked={on} aria-label={t('cp34.consignee')} onCheckedChange={(v) => (useDemoStore.getState().setConsigneeMessages(customer.id, v, user.id), toast.success(t(v ? 'cp34.on' : 'cp34.off')))} />
        </section>
      )}
    </div>
  )
}
