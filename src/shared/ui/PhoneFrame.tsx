import { cn } from '@/shared/lib/utils'

/**
 * A 360 × 760 phone in the browser (design-system.md §5; Partner App spec PA-04).
 * On a real phone-sized screen the frame drops away and the app goes full-screen.
 */
export function PhoneFrame({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {label && <span className="text-caption font-medium text-muted-foreground">{label}</span>}
      <div className="relative h-dvh w-full overflow-hidden bg-background sm:h-[760px] sm:w-[360px] sm:rounded-[36px] sm:border-[10px] sm:border-gray-900 sm:shadow-xl">
        {/* notch */}
        <div aria-hidden className="absolute top-0 left-1/2 z-20 hidden h-5 w-28 -translate-x-1/2 rounded-b-xl bg-gray-900 sm:block" />
        <div className="flex h-full flex-col text-[16px] leading-6">{children}</div>
      </div>
    </div>
  )
}
