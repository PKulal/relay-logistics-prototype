/** Turn a list of records into the store's `Record<id, T>` shape. */
export function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((item) => [item.id, item]))
}
