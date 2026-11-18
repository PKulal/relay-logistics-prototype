import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'
import { EmptyState } from './EmptyState'
import { Skeleton } from './skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Makes the column sortable */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  pageSize?: number
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  /** Initial sort */
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  className?: string
}

/** Sortable, paginated table with loading skeleton and empty state (design-system.md §6, §7). */
export function DataTable<T>({ rows, columns, rowKey, loading, pageSize = 10, onRowClick, empty, defaultSort, className }: DataTableProps<T>) {
  const { t } = useTranslation()
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
  }, [rows, columns, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)
  const align = (c: Column<T>) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <Table className="text-table">
        <TableHeader className="bg-gray-50">
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={cn(align(c), c.className)}>
                {c.sortValue ? (
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 font-semibold">
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === 'asc' ? <ArrowUp className="size-3.5" aria-label={t('table.sortedAsc')} /> : <ArrowDown className="size-3.5" aria-label={t('table.sortedDesc')} />
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                    )}
                  </button>
                ) : (
                  <span className="font-semibold">{c.header}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: Math.min(pageSize, 5) }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : visible.map((row) => (
                <TableRow key={rowKey(row)} onClick={onRowClick && (() => onRowClick(row))} className={cn(onRowClick && 'cursor-pointer')}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn('tabular', align(c), c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {!loading && rows.length === 0 && (empty ?? <EmptyState title={t('table.emptyTitle')} />)}

      {!loading && rows.length > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-2 text-caption text-muted-foreground">
          <span className="tabular">
            {t('table.range', { from: current * pageSize + 1, to: Math.min(sorted.length, (current + 1) * pageSize), total: sorted.length })}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t('table.previous')}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t('table.next')}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
