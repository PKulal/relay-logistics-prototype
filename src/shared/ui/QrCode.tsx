import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/utils'

/** A real, scannable QR code rendered as inline SVG (labels, LR, e-POD). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    void QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then((s) => !cancelled && setSvg(s))
    return () => {
      cancelled = true
    }
  }, [value])
  return <div role="img" aria-label={label} className={cn('aspect-square [&>svg]:size-full', className)} dangerouslySetInnerHTML={{ __html: svg }} />
}
