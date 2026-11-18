import { AlertTriangle, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import type { LegStatus, ShipmentStatus } from '@shared/types'
import { LEG_TONE, SHIPMENT_TONE, TONE_CLASS, type Tone } from './tones'

interface ChipProps {
  tone: Tone
  children: React.ReactNode
  bold?: boolean
  strike?: boolean
  className?: string
}

/** Generic status chip. Danger and warning always carry an icon: colour is never the only signal (§3). */
export function Chip({ tone, children, bold, strike, className }: ChipProps) {
  const Icon = tone === 'danger' ? CircleAlert : tone === 'warning' ? AlertTriangle : null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption whitespace-nowrap',
        bold ? 'font-semibold' : 'font-medium',
        strike && 'line-through',
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  )
}

export function ShipmentStatusChip({ status }: { status: ShipmentStatus }) {
  const { t } = useTranslation()
  return (
    <Chip tone={SHIPMENT_TONE[status]} bold={status === 'outForDelivery'} strike={status === 'cancelled'}>
      {t(`status.shipment.${status}`)}
    </Chip>
  )
}

export function LegStatusChip({ status }: { status: LegStatus }) {
  const { t } = useTranslation()
  return <Chip tone={LEG_TONE[status]}>{t(`status.leg.${status}`)}</Chip>
}
