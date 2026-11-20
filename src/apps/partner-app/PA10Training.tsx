/**
 * PA-10 Training and practice mode — docs/03-partner-app.md. Source §4 Step 6
 * ("training videos and practice mode for scan, hand-over, seal and e-POD — in
 * Hindi and English"). Videos are SIMULATED (a still and a progress bar).
 * Practice tasks use the real scanner, photo, code, seal, OTP and signature
 * controls on a dummy shipment with a "Practice" watermark; nothing is written
 * to shipments or sent to customers. Status shows on PP-29.
 */
import { CheckCircle2, ChevronRight, CirclePlay, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { canCompleteTraining, PRACTICE, PRACTICE_CODE, PRACTICE_PIECES, PRACTICE_SEAL, trainingStatus, VIDEOS, type PracticeStep, type VideoId } from '@shared/engines/fieldDay'
import { DEMO_DELIVERY_OTP } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SignaturePad } from '@shared/ui/SignaturePad'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useFieldSession } from './useFieldSession'

export default function PA10Training() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const [playing, setPlaying] = useState<VideoId>()
  const videos = VIDEOS[staff.role]
  const practice = PRACTICE[staff.role]
  const watched = staff.training?.videos ?? []
  const passed = staff.training?.practice ?? []
  const status = trainingStatus(staff)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-[22px] font-bold">{t('pa10.title')}</h1>
        <Chip tone={status === 'done' ? 'success' : status === 'inProgress' ? 'info' : 'warning'}>{t(`pa10.status.${status}`)}</Chip>
      </div>

      <section aria-label={t('pa10.videos')} className="flex flex-col gap-2">
        <h2 className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">{t('pa10.videosCount', { watched: watched.filter((v) => (videos as string[]).includes(v)).length, total: videos.length })}</h2>
        {videos.map((v) => (
          <button key={v} type="button" onClick={() => setPlaying(v)} className="flex min-h-12 items-center gap-3 rounded-2xl border bg-card p-3 text-left">
            {watched.includes(v) ? <CheckCircle2 className="size-6 text-status-success" aria-hidden /> : <CirclePlay className="size-6 text-primary" aria-hidden />}
            <span className="flex-1 font-medium">{t(`pa10.video.${v}`)}</span>
            <span className="text-caption text-muted-foreground">{watched.includes(v) ? t('pa10.watched') : '2:30'}</span>
          </button>
        ))}
      </section>

      <section aria-label={t('pa10.practice')} className="flex flex-col gap-2">
        <h2 className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">{t('pa10.practice')}</h2>
        {practice.map((p) => (
          <Link key={p.id} to={`/app/training/${p.id}`} className="flex min-h-12 items-center gap-3 rounded-2xl border bg-card p-3">
            {passed.includes(p.id) ? <CheckCircle2 className="size-6 text-status-success" aria-hidden /> : <GraduationCap className="size-6 text-primary" aria-hidden />}
            <span className="flex-1 font-medium">{t(`pa10.task.${p.id}`)}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        <p className="text-caption text-muted-foreground">{t('pa10.practiceNote')}</p>
      </section>

      {!staff.trained && (
        <Button size="lg" disabled={!canCompleteTraining(staff)} onClick={() => (useDemoStore.getState().completeTraining(staff.id), toast.success(t('pa10.completed')))}>
          {t('pa10.complete')}
        </Button>
      )}
      {playing && <VideoDialog id={playing} onClose={() => setPlaying(undefined)} />}
    </div>
  )
}

function VideoDialog({ id, onClose }: { id: VideoId; onClose: () => void }) {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPct((p) => Math.min(100, p + 20)), 250)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (pct === 100) useDemoStore.getState().watchVideo(staff.id, id)
  }, [pct, staff.id, id])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t(`pa10.video.${id}`)} <SimulatedTag />
          </DialogTitle>
          <DialogDescription>{t(`pa10.videoBody.${id}`)}</DialogDescription>
        </DialogHeader>
        <div className="flex aspect-video items-center justify-center rounded-lg bg-gray-900 text-white">
          <CirclePlay className="size-12 opacity-70" aria-hidden />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('pa10.progress')}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <Button onClick={onClose}>{pct === 100 ? t('pa10.done') : t('pa10.close')}</Button>
      </DialogContent>
    </Dialog>
  )
}

/** One practice task: the real controls on a dummy shipment, step by step. */
export function PA10Practice() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { taskId = '' } = useParams()
  const { staff } = useFieldSession()
  const task = PRACTICE[staff.role].find((p) => p.id === taskId)
  const [step, setStep] = useState(0)
  const [scanned, setScanned] = useState<string[]>([])
  const [photo, setPhoto] = useState('')
  const [text, setText] = useState('')
  const [signed, setSigned] = useState(false)
  if (!task) return <p className="p-4">{t('pa10.unknown')}</p>
  const kind: PracticeStep = task.steps[step]
  const ok = kind === 'scan' ? scanned.length === PRACTICE_PIECES.length : kind === 'photo' ? !!photo : kind === 'code' ? text === PRACTICE_CODE : kind === 'seal' ? text.trim().toUpperCase() === PRACTICE_SEAL : kind === 'otp' ? text === DEMO_DELIVERY_OTP : signed
  const next = () => {
    setText('')
    if (step + 1 < task.steps.length) return setStep(step + 1)
    useDemoStore.getState().passPractice(staff.id, task.id)
    toast.success(t('pa10.passed', { task: t(`pa10.task.${task.id}`) }))
    navigate('/app/training')
  }

  return (
    <div className="relative flex flex-col gap-4 p-4">
      {/* Watermark: practice only */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
        <span className="-rotate-30 text-[56px] font-black tracking-widest text-gray-900/10 uppercase">{t('pa10.watermark')}</span>
      </div>
      <Chip tone="warning">{t('pa10.banner')}</Chip>
      <h1 className="font-heading text-[20px] font-bold">{t(`pa10.task.${task.id}`)}</h1>
      <ol className="flex gap-1" aria-label={t('pa10.steps')}>
        {task.steps.map((s, i) => (
          <li key={s} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-gray-100')} />
        ))}
      </ol>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-label={t(`pa10.step.${kind}`)}>
        <h2 className="font-bold">{t(`pa10.step.${kind}`)}</h2>
        <p className="text-caption text-muted-foreground">{t(`pa10.hint.${kind}`, { code: PRACTICE_CODE, seal: PRACTICE_SEAL, otp: DEMO_DELIVERY_OTP })}</p>
        {kind === 'scan' && <Scanner expected={PRACTICE_PIECES} scanned={scanned} onScan={(c) => setScanned((x) => (x.includes(c) ? x : [...x, c]))} />}
        {kind === 'photo' && <PhotoCapture label={t('pa10.photo')} caption="practice" value={photo} onChange={setPhoto} idBase="practice" required />}
        {(kind === 'code' || kind === 'seal' || kind === 'otp') && <Input aria-label={t(`pa10.step.${kind}`)} value={text} inputMode={kind === 'seal' ? 'text' : 'numeric'} onChange={(e) => setText(e.target.value)} className="h-12 text-[18px]" />}
        {kind === 'sign' && <SignaturePad label={t('pa10.sign')} onChange={setSigned} />}
      </section>
      <Button size="lg" disabled={!ok} onClick={next}>
        {step + 1 < task.steps.length ? t('pa10.next') : t('pa10.finish')}
      </Button>
    </div>
  )
}
