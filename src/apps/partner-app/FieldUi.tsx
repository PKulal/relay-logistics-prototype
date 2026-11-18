/** Small building blocks shared by the Partner App task screens (big text, 48 px targets). */
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function Choice({ checked, onClick, label, checkbox }: { checked: boolean; onClick: () => void; label: string; checkbox?: boolean }) {
  return (
    <button type="button" role={checkbox ? 'checkbox' : 'radio'} aria-checked={checked} onClick={onClick} className="flex min-h-12 w-full items-center gap-3 text-left">
      <span className={cn('flex size-6 shrink-0 items-center justify-center border-2', checkbox ? 'rounded-md' : 'rounded-full', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-gray-500')}>
        {checked && <Check className="size-4" aria-hidden />}
      </span>
      {label}
    </button>
  )
}
