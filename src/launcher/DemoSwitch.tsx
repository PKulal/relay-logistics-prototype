/**
 * Demo shortcut: /app/as/:staffId?to=/app/… logs this tab in to the Partner App
 * as another field staff member (in their language) and opens the given screen.
 * Used by PA-19 "Open the receiver's phone" so a second tab can complete the
 * hand-over. Real phones log in with PA-02.
 */
import { useEffect } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { useSession, useSessionUser } from '@shared/store/session'

export default function DemoSwitch() {
  const { staffId = '' } = useParams()
  const [params] = useSearchParams()
  const staff = useData((d) => d.fieldStaff[staffId])
  const current = useSessionUser('partnerApp')
  const to = params.get('to') ?? ''
  const target = to.startsWith('/app') ? to : '/app'

  useEffect(() => {
    if (!staff) return
    const session = useSession.getState()
    session.login('partnerApp', staff.id)
    // The app has English and Hindi; Kannada speakers get English for now
    session.setLanguage(staff.language === 'hi' ? 'hi' : 'en')
  }, [staff])

  if (!staff) return <Navigate to="/launch/partner-app" replace />
  // Once this tab is logged in as them, open the screen
  return current === staff.id ? <Navigate to={target} replace /> : null
}
