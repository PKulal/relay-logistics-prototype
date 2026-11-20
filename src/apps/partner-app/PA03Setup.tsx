/**
 * PA-03 Permissions and profile check — docs/03-partner-app.md. Source §5.1
 * (camera for scans and photos, location for geo-tags and tracking). The
 * permission prompts are SIMULATED; the profile is what the company
 * registered (PP-29). Continue goes Home, which prompts for training (PA-10).
 */
import { BatteryCharging, Bell, Camera, Check, MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { trainingStatus } from '@shared/engines/fieldDay'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Chip } from '@shared/ui/StatusChip'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useFieldSession } from './useFieldSession'

const PERMS = [
  { key: 'camera', icon: Camera, required: true },
  { key: 'location', icon: MapPin, required: true },
  { key: 'notifications', icon: Bell, required: true },
  { key: 'calls', icon: Phone, required: false },
  { key: 'battery', icon: BatteryCharging, required: false },
] as const

export default function PA03Setup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff, partner } = useFieldSession()
  const data = useData((d) => d)
  const [allowed, setAllowed] = useState<string[]>([])
  const ready = PERMS.every((p) => !p.required || allowed.includes(p.key))
  const training = trainingStatus(staff)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="flex items-center gap-2 font-heading text-[22px] font-bold">
        {t('auth.pa.setup')} <SimulatedTag />
      </h1>
      <section className="flex flex-col gap-2" aria-label={t('auth.pa.permissions')}>
        {PERMS.map((p) => {
          const on = allowed.includes(p.key)
          return (
            <div key={p.key} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-3">
              <p.icon className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-bold">{t(`auth.pa.perm.${p.key}`)}</span>
                <span className="block text-caption text-muted-foreground">{t(`auth.pa.why.${p.key}`)}</span>
              </span>
              <Button size="sm" variant={on ? 'outline' : 'default'} disabled={on} onClick={() => setAllowed([...allowed, p.key])} className={cn(on && 'text-status-success')}>
                {on ? <Check /> : null} {on ? t('auth.pa.allowed') : p.key === 'battery' ? t('auth.pa.turnOff') : t('auth.pa.allow')}
              </Button>
            </div>
          )
        })}
      </section>
      <section className="rounded-2xl border bg-card p-4" aria-label={t('auth.pa.profile')}>
        <h2 className="mb-2 font-bold">{t('auth.pa.profile')}</h2>
        <p className="text-[18px] font-bold">{staff.name}</p>
        <p>
          {t(`roles.field.${staff.role}`)} · {partner.shortName} ({t('partner.typeShort', { type: partner.type })})
        </p>
        <p className="text-caption text-muted-foreground">
          {staff.vehicleId ? `${data.vehicles[staff.vehicleId]?.regNo} · ` : ''}
          {staff.hubId ? data.hubs[staff.hubId]?.name : partner.city}
        </p>
        <div className="mt-2">
          <Chip tone={training === 'done' ? 'success' : 'warning'}>{t(`pa10.status.${training}`)}</Chip>
        </div>
      </section>
      <Button
        size="lg"
        className="h-14 text-[18px]"
        disabled={!ready}
        onClick={() => {
          useDemoStore.getState().activateFieldApp(staff.id)
          navigate(training === 'done' ? '/app' : '/app/training')
        }}
      >
        {t('auth.pa.continue')}
      </Button>
      {!ready && <p className="text-center text-caption text-muted-foreground">{t('auth.pa.needRequired')}</p>}
    </div>
  )
}
