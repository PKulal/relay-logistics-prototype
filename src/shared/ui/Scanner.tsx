/**
 * PA-07 Scanner (shared component) — piece labels, bags, seals.
 * SIMULATED camera: "Tap to scan" reads the next expected label; a second
 * button reads a wrong one. Every scan beeps, vibrates and speaks (spec §9.2).
 */
import { CheckCircle2, CircleAlert, Keyboard, ScanLine, TriangleAlert, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { beep, speak, vibrate } from '@shared/sim/feedback'
import { useSession } from '@shared/store/session'
import { PhotoCapture } from './PhotoCapture'
import { SimulatedTag } from './SimulatedTag'
import { Switch } from './switch'

type Result = { kind: 'ok' | 'duplicate' | 'wrong'; code: string } | null

interface ScannerProps {
  /** Labels this task expects, in order (e.g. piece ids) */
  expected: string[]
  /** Already scanned (controlled) */
  scanned: string[]
  onScan: (code: string) => void
  /** Hub bulk scanning: camera stays open between scans */
  continuousDefault?: boolean
  /** Short label for the counter, e.g. the piece suffix: "LGS-DEL-000781-04" → "04" */
  shortLabel?: (code: string) => string
}

/** A label that belongs to nothing in this task, for the "wrong label" demo button. */
const WRONG = 'LGS-BOM-000999-01'

export function Scanner({ expected, scanned, onScan, continuousDefault = false, shortLabel = (c) => c.slice(-2) }: ScannerProps) {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const [last, setLast] = useState<Result>(null)
  const [continuous, setContinuous] = useState(continuousDefault)
  const [manual, setManual] = useState(false)
  const [typed, setTyped] = useState('')
  const [labelPhoto, setLabelPhoto] = useState('')
  const missing = expected.filter((c) => !scanned.includes(c))
  const done = missing.length === 0

  const read = (code: string) => {
    const kind: NonNullable<Result>['kind'] = !expected.includes(code) ? 'wrong' : scanned.includes(code) ? 'duplicate' : 'ok'
    setLast({ kind, code })
    beep(kind === 'ok')
    vibrate(kind === 'ok')
    if (kind === 'ok') {
      onScan(code)
      speak(t('scanner.voiceCount', { n: scanned.length + 1, total: expected.length }), language)
    } else {
      speak(t(kind === 'wrong' ? 'scanner.voiceWrong' : 'scanner.voiceDuplicate'), language)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Viewfinder */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-white">
        <div className="absolute inset-6 rounded-lg border-2 border-brand-amber/80" aria-hidden />
        <div className="absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-status-danger" aria-hidden />
        <div className="relative text-center">
          <p className="tabular font-heading text-[40px] leading-none font-bold" aria-live="polite" data-testid="scan-counter">
            {scanned.length} / {expected.length}
          </p>
          <p className="mt-1 text-caption text-gray-100/80">{done ? t('scanner.allScanned') : t('scanner.pointCamera')}</p>
        </div>
        <span className="absolute top-2 right-2">
          <SimulatedTag />
        </span>
      </div>

      {/* Last result */}
      {last && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 font-semibold',
            last.kind === 'ok' && 'bg-status-success-bg text-status-success',
            last.kind === 'duplicate' && 'bg-status-warning-bg text-status-warning',
            last.kind === 'wrong' && 'bg-status-danger-bg text-status-danger',
          )}
        >
          {last.kind === 'ok' ? <CheckCircle2 className="size-5" aria-hidden /> : last.kind === 'duplicate' ? <TriangleAlert className="size-5" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
          {t(`scanner.result.${last.kind}`, { label: shortLabel(last.code), n: expected.indexOf(last.code) + 1, total: expected.length })}
        </div>
      )}

      {/* Simulated camera buttons */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" disabled={done} onClick={() => read(missing[0])} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          <ScanLine className="size-6" aria-hidden /> {t('scanner.tap')}
        </button>
        <button type="button" onClick={() => read(WRONG)} className="inline-flex min-h-14 items-center justify-center gap-1 rounded-xl border-2 px-3 text-caption font-semibold">
          <Zap className="size-4" aria-hidden /> {t('scanner.wrong')}
        </button>
      </div>

      <label className="flex min-h-12 items-center justify-between gap-2">
        <span>{t('scanner.continuous')}</span>
        <Switch checked={continuous} onCheckedChange={setContinuous} />
      </label>

      {/* Manual entry: needs a photo of the damaged label (assumed) */}
      <button type="button" onClick={() => setManual((m) => !m)} className="inline-flex min-h-12 w-fit items-center gap-2 font-medium text-primary">
        <Keyboard className="size-4" aria-hidden /> {t('scanner.manual')}
      </button>
      {manual && (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <label className="flex flex-col gap-1">
            <span className="text-caption font-medium">{t('scanner.pieceId')}</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} className="h-12 rounded-lg border border-input px-3 text-[16px]" placeholder={expected[0]} />
          </label>
          <PhotoCapture label={t('scanner.labelPhoto')} caption={t('scanner.labelPhotoCaption')} value={labelPhoto} onChange={setLabelPhoto} idBase="label" required />
          <button
            type="button"
            disabled={!typed || !labelPhoto}
            onClick={() => {
              read(typed.trim())
              setTyped('')
              setLabelPhoto('')
              if (!continuous) setManual(false)
            }}
            className="min-h-12 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t('scanner.add')}
          </button>
        </div>
      )}

      {/* Missing list */}
      {missing.length > 0 && (
        <p className="text-caption text-muted-foreground">
          {t('scanner.missing')}: <span className="tabular font-medium text-foreground">{missing.map(shortLabel).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
