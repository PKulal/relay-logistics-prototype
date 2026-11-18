import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@shared/store/session'

/** English / हिन्दी switch (header of every app). Per tab, like the login. */
export function LanguageToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)
  const next = language === 'en' ? 'hi' : 'en'
  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-medium hover:bg-accent', className)}
      aria-label={t('common.switchLanguage')}
      title={t('common.switchLanguage')}
    >
      <Languages className="size-4" aria-hidden />
      {!compact && <span>{next === 'hi' ? 'हिन्दी' : 'English'}</span>}
    </button>
  )
}
