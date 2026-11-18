/**
 * PA-07 Scanner from the Scan tab — docs/03-partner-app.md §6.1.
 * Scan any label: the app finds the task it belongs to and opens it.
 * SIMULATED: "Tap to scan" reads the first piece of the next open task; the
 * hand-over QR button reads the code on a giver's screen (PA-19 → PA-20).
 */
import { QrCode } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { nextTask, prevLegOf, tasksFor } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { handoverState } from '@shared/store/handoverActions'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
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
  // Hand-overs waiting for me, with the code the giver is showing
  const handovers = tasks
    .filter((x) => x.kind === 'receive')
    .map((x) => {
      const prev = prevLegOf(data, x.leg)!
      return { task: x, given: handoverState(data, prev.id).given, giver: prev.staffId ? data.fieldStaff[prev.staffId]?.name : data.partners[prev.partnerId].shortName }
    })
    .filter((h) => h.given?.handoverCode)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa07.title')}</h1>
      <p className="text-muted-foreground">{t('pa07.body')}</p>
      {handovers.map((h) => (
        <button
          key={h.task.leg.id}
          type="button"
          onClick={() => navigate(`/app/tasks/${h.task.leg.id}?code=${h.given!.handoverCode}`)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft font-semibold text-primary"
        >
          <QrCode className="size-5" aria-hidden /> {t('pa07.handoverQr', { name: h.giver })} <SimulatedTag />
        </button>
      ))}
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
