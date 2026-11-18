/**
 * Opens the right screen for a task (/app/tasks/:legId). Opening a task marks
 * its "New" notification read. After pickup the rider's task is the hand-over
 * (PA-19); a hub job with goods on the way is the receive (PA-20). Screens for
 * later build-plan items show their
 * placeholder with the screen id.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { isReceive } from '@shared/engines/fieldTasks'
import { NotFound, ScreenPlaceholder } from '@shared/ui/Page'
import PA14PickupDetail from './PA14PickupDetail'
import PA19HandOver from './PA19HandOver'
import PA20Receive from './PA20Receive'
import PickupFlow from './PickupFlow'
import { useFieldSession } from './useFieldSession'

/** Screen ids for tasks whose screens come later in Phase 2 (build plan). */
const LATER: Record<string, string> = {
  handover: 'PA-19',
  lineHaul: 'PA-21',
  originHub: 'PA-25',
  destHub: 'PA-25',
  lastMile: 'PA-31',
}

export default function TaskScreen({ flow }: { flow?: 'pickup' }) {
  const { t } = useTranslation()
  const { legId = '' } = useParams()
  const { staff } = useFieldSession()
  const leg = useData((d) => d.legs[legId])
  const receive = useData((d) => (d.legs[legId] ? isReceive(d, d.legs[legId]) : false))
  const unread = useData((d) => d.notifications)

  useEffect(() => {
    const ids = Object.values(unread)
      .filter((n) => n.audience.app === 'partnerApp' && n.audience.userId === staff.id && !n.read && n.title === legId)
      .map((n) => n.id)
    if (ids.length) useDemoStore.getState().markNotificationsRead(ids)
  }, [unread, staff.id, legId])

  if (!leg || leg.staffId !== staff.id) {
    return (
      <div className="p-4">
        <NotFound />
      </div>
    )
  }

  if (leg.type === 'firstMile' && leg.status === 'assigned') {
    return flow === 'pickup' ? <PickupFlow leg={leg} /> : <PA14PickupDetail leg={leg} />
  }
  // The pickup flow for a job that is no longer waiting for pickup (e.g. just
  // confirmed): back to the task list, where it now shows as the hand-over.
  if (flow === 'pickup') return <Navigate to="/app/tasks" replace />

  if (leg.type === 'firstMile' && (leg.status === 'inProgress' || leg.status === 'handedOver')) return <PA19HandOver leg={leg} />
  if (receive) return <PA20Receive leg={leg} />

  const screenId = leg.type === 'firstMile' ? LATER.handover : LATER[leg.type]
  return (
    <div className="p-4">
      <ScreenPlaceholder screenId={`${screenId} · ${leg.id}`} title={t(`pa.later.${leg.type === 'firstMile' ? 'handover' : leg.type}`)} phase={2} />
    </div>
  )
}
