import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge must know our custom type scale (index.css §4): otherwise it
 * reads `text-table` as a text COLOUR and drops a real colour such as
 * `text-primary-foreground` from the same element.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['page-title', 'section', 'card-title', 'body', 'table', 'caption'] }],
    },
  },
})

/** Merge Tailwind class names (used by shadcn/ui components). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
