/**
 * PA-07 Scanner from the Scan tab — docs/03-partner-app.md §6.1.
 * Scan any label: the app finds the task it belongs to and opens it.
 * SIMULATED: "Tap to scan" reads the first piece of the next open task.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { nextTask, tasksFor } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { Scanner } from '@shared/ui/Scanner'
import { useFieldSession } from './useFieldSession'

export default function PA07ScanTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const tasks = useMemo(() => tasksFor(data, staff.id, now), [data, staff.id, now])
  const target = nextTask(tasks)
  const [scanned, setScanned] = useState<string[]>([])
  // The simulated camera reads the first label of the next open task
  const expected = target ? [target.shipment.pieces[0].id] : []

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa07.title')}</h1>
      <p className="text-muted-foreground">{t('pa07.body')}</p>
      {target ? (
        <Scanner
          expected={expected}
          scanned={scanned}
          shortLabel={(c) => c}
          onScan={(code) => {
            setScanned((s) => [...s, code])
            const task = tasks.find((x) => x.shipment.pieces.some((p) => p.id === code))
            if (task) setTimeout(() => navigate(`/app/tasks/${task.leg.id}`), 600)
          }}
        />
      ) : (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa05.nothing')}</p>
      )}
    </div>
  )
}
