/**
 * SOS from the Partner App (PA-12; source §5.1): ERP-09 "SOS alerts" panel and
 * the blocking banner on ERP-07. SIMULATED: live location.
 */
import { MapPin, Siren } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { activeSos } from '@shared/engines/escalations'
import { useData } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { SosAlert } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useErpSession } from './useErpSession'

/** Live alerts; renders nothing when there are none unless `showEmpty`. */
export function SosAlerts({ showEmpty }: { showEmpty?: boolean }) {
  const { t } = useTranslation()
  const alerts = activeSos(useData((d) => d.sosAlerts))
  if (!alerts.length)
    return showEmpty ? (
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('sos.title')} data-testid="sos-alerts">
        <h2 className="mb-1 font-semibold">{t('sos.title')}</h2>
        <p className="text-muted-foreground">{t('sos.none')}</p>
      </section>
    ) : null
  return (
    <section role="alert" className="flex flex-col gap-2 rounded-xl border-2 border-status-danger bg-status-danger-bg p-4" aria-label={t('sos.title')} data-testid="sos-alerts">
      <h2 className="flex items-center gap-2 font-semibold text-status-danger">
        <Siren className="size-5" aria-hidden /> {t('sos.title')} · {alerts.length}
      </h2>
      {alerts.map((a) => (
        <SosRow key={a.id} a={a} />
      ))}
    </section>
  )
}

function SosRow({ a }: { a: SosAlert }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [note, setNote] = useState('')
  const staff = data.fieldStaff[a.staffId]
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3" aria-label={a.id}>
      <div className="min-w-56 flex-1">
        <p className="font-semibold">
          {staff.name} · {data.partners[a.partnerId].shortName} · <span className="tabular">{staff.mobile}</span>
        </p>
        <p className="tabular flex items-center gap-1 text-caption text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden /> {a.lat.toFixed(4)}, {a.lng.toFixed(4)} · {formatTime(a.at)} {a.kind && `· ${t(`pa12.k.${a.kind}`)}`} <SimulatedTag />
        </p>
      </div>
      <Input aria-label={t('sos.note')} placeholder={t('sos.note')} value={note} onChange={(e) => setNote(e.target.value)} className="h-8 w-56" />
      <Button
        size="sm"
        onClick={() => {
          useDemoStore.getState().resolveSos(a.id, note, user.id)
          toast.success(t('sos.resolved', { name: staff.name }))
        }}
      >
        {t('sos.resolve')}
      </Button>
    </div>
  )
}
