/** Loading state while an app's code arrives (design-system.md §7: every screen has a loading skeleton). */
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@shared/ui/skeleton'

export function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('app.loading')} className="flex min-h-dvh flex-col bg-gray-50">
      <div className="flex h-14 items-center gap-3 border-b bg-background px-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="ml-4 h-9 max-w-md flex-1" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-60 flex-col gap-3 border-r bg-background p-4 md:flex">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
