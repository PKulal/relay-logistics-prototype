/** On-screen signature (PA-17 shipper confirmation, PA-33 e-POD). Real drawing on a canvas. */
import { Eraser } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function SignaturePad({ onChange, label }: { onChange: (signed: boolean) => void; label: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = c.offsetWidth * 2
    c.height = c.offsetHeight * 2
    ctx.scale(2, 2)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#151515'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={ref}
        aria-label={label}
        role="img"
        className="h-36 w-full touch-none rounded-lg border-2 border-dashed border-gray-500 bg-white"
        onPointerDown={(e) => {
          const ctx = e.currentTarget.getContext('2d')
          if (!ctx) return
          drawing.current = true
          const p = point(e)
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = e.currentTarget.getContext('2d')
          if (!ctx) return
          const p = point(e)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }}
        onPointerUp={() => {
          if (drawing.current) onChange(true)
          drawing.current = false
        }}
      />
      <button
        type="button"
        className="inline-flex min-h-12 w-fit items-center gap-2 px-2 text-caption font-medium text-muted-foreground"
        onClick={() => {
          const c = ref.current
          c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
          onChange(false)
        }}
      >
        <Eraser className="size-4" aria-hidden /> {t('signature.clear')}
      </button>
    </div>
  )
}
