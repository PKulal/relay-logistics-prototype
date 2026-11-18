/**
 * SIMULATED photo capture (design-system.md §6): a shutter flash, then a
 * generated thumbnail stands in for the camera picture. The stored value is a
 * photo id; the thumbnail is drawn from it, so nothing large goes in the store.
 */
import { Camera, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { photoThumb } from '@shared/sim/photos'
import { SimulatedTag } from './SimulatedTag'

interface PhotoCaptureProps {
  /** e.g. "Invoice photo" */
  label: string
  /** Caption burnt into the simulated picture, e.g. "Scale 20.5 kg" */
  caption: string
  /** Photo id, or '' when not taken */
  value: string
  onChange: (photoId: string) => void
  /** Base for the generated id, e.g. "LGS-DEL-000781-invoice" */
  idBase: string
  required?: boolean
  className?: string
}

export function PhotoCapture({ label, caption, value, onChange, idBase, required, className }: PhotoCaptureProps) {
  const { t } = useTranslation()
  const [flash, setFlash] = useState(false)
  const take = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    onChange(`${idBase}:${caption}`)
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {value ? (
          <img src={photoThumb(value.split(':').slice(1).join(':') || caption)} alt={t('photo.taken', { label })} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Camera className="size-6" aria-hidden />
          </span>
        )}
        {flash && <span className="absolute inset-0 animate-pulse bg-white" aria-hidden />}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">
          {label}
          {required && <span className="text-status-danger"> *</span>}
        </span>
        <button type="button" onClick={take} className="inline-flex min-h-12 w-fit items-center gap-2 rounded-lg border-2 border-primary px-4 font-semibold text-primary">
          {value ? <RotateCcw className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
          {value ? t('photo.retake') : t('photo.take')}
        </button>
        <SimulatedTag />
      </div>
    </div>
  )
}
