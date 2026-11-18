/** Small selectors over the shared store, so screens don't reach into its shape. */
import { useDemoStore } from '@shared/store'
import type { DemoData } from '@shared/types'

export const useDemoNow = () => useDemoStore((s) => s.demoNow)
export const useFlags = () => useDemoStore((s) => s.flags)

/** Select one collection or value from the data set. */
export function useData<T>(selector: (data: DemoData) => T): T {
  return useDemoStore((s) => selector(s.data))
}
