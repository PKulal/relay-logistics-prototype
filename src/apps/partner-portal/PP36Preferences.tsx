/**
 * PP-36 Preferences — docs/02-partner-portal.md. Source §14 (Hindi + English;
 * the user picks the language). The event × channel matrix is not built (no
 * basis in the client document).
 */
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { Field } from '@shared/ui/FormField'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { usePartnerSession } from './usePartnerSession'

export default function PP36Preferences() {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const setLanguage = useSession((s) => s.setLanguage)
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={t('cp34.title')} subtitle={t('pp36.subtitle')} className="mb-0" />
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp34.language')}>
        <Field label={t('cp34.language')} htmlFor="pp-lang" hint={t('cp34.languageHint')}>
          <NativeSelect
            id="pp-lang"
            value={user.language ?? 'en'}
            onChange={(e) => {
              const lang = e.target.value as 'en' | 'hi'
              useDemoStore.getState().setPortalUserLanguage(user.id, lang)
              setLanguage(lang)
              toast.success(t('cp34.saved'))
            }}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </NativeSelect>
        </Field>
      </section>
    </div>
  )
}
