/**
 * PA-06 Task list — docs/03-partner-app.md §6.1. Opened from the Tasks, Trip or
 * Inbound tab. Tasks appear when the partner office assigns them (PP-14).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { TASK_STATES, tasksFor, type TaskState } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { beep } from '@shared/sim/feedback'
import { TaskCard } from './TaskCard'
import { useFieldSession } from './useFieldSession'

export default function PA06Tasks() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [tab, setTab] = useState<TaskState>('todo')
  const tasks = useMemo(() => tasksFor(data, staff.id, now), [data, staff.id, now])
  const shown = tasks.filter((x) => x.state === tab)
  const newCount = tasks.filter((x) => x.newNotificationIds.length > 0).length

  // A new task arriving while the list is open plays a sound (PA-06 rule)
  const seen = useRef(newCount)
  useEffect(() => {
    if (newCount > seen.current) beep(true)
    seen.current = newCount
  }, [newCount])

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label={t('pa06.title')} className="sticky top-0 z-10 grid grid-cols-4 border-b bg-background">
        {TASK_STATES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={cn('min-h-12 border-b-2 px-1 text-[14px] font-semibold', tab === s ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            {t(`pa06.tab.${s}`)} <span className="tabular">({tasks.filter((x) => x.state === s).length})</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">
        {shown.length === 0 ? <p className="py-10 text-center text-muted-foreground">{t(`pa06.empty.${tab}`)}</p> : shown.map((task) => <TaskCard key={task.leg.id} task={task} />)}
      </div>
    </div>
  )
}
