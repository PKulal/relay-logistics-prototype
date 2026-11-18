/** Small pieces shared by the Partner Portal job screens (PP-11 to PP-14). */
import { Banknote, CalendarClock, FileText, Flag, Package, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Special } from '@shared/engines/partnerJobs'
import { useDemoStore } from '@shared/store'
import type { FlagReason, ProblemKind } from '@shared/store/partnerActions'
import type { Id, IsoDateTime } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Chip } from '@shared/ui/StatusChip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'

const SPECIAL_ICON: Record<Special, typeof Banknote> = { cod: Banknote, appointment: CalendarClock, fragile: Package, oda: TriangleAlert, ewb: FileText }

export function SpecialIcons({ specials }: { specials: Special[] }) {
  const { t } = useTranslation()
  if (specials.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex gap-1.5">
      {specials.map((s) => {
        const Icon = SPECIAL_ICON[s]
        return (
          <Tooltip key={s}>
            <TooltipTrigger asChild>
              <span className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-gray-700" aria-label={t(`pp.special.${s}`)}>
                <Icon className="size-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t(`pp.special.${s}`)}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

/** "22 min" to accept, or "Overdue 5 min" (no automatic withdrawal in the prototype). */
export function AcceptByChip({ acceptBy, now }: { acceptBy: IsoDateTime; now: IsoDateTime }) {
  const { t } = useTranslation()
  const mins = Math.round((Date.parse(acceptBy) - Date.parse(now)) / 60000)
  if (mins < 0) return <Chip tone="danger">{t('pp.overdue', { mins: -mins })}</Chip>
  return <Chip tone={mins <= 10 ? 'warning' : 'info'}>{t('pp.minsLeft', { mins })}</Chip>
}

const FLAG_REASONS: FlagReason[] = ['pincodeNotServed', 'capacityFull', 'noVehicle', 'holiday', 'other']

export function FlagDialog({ legId, userId, onClose }: { legId: Id; userId: Id; onClose: () => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<FlagReason>('capacityFull')
  const [remark, setRemark] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp.flag.title', { job: legId })}</DialogTitle>
          <DialogDescription>{t('pp.flag.body')}</DialogDescription>
        </DialogHeader>
        <Field label={t('pp.flag.reason')} htmlFor="flag-reason">
          <NativeSelect id="flag-reason" value={reason} onChange={(e) => setReason(e.target.value as FlagReason)}>
            {FLAG_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`pp.flag.reasons.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('pp.flag.remark')} htmlFor="flag-remark" error={reason === 'other' && !remark.trim() ? t('cp13.err.required') : undefined}>
          <textarea id="flag-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={reason === 'other' && !remark.trim()}
            onClick={() => {
              useDemoStore.getState().flagLeg(legId, reason, remark.trim(), userId)
              toast.success(t('pp.flag.done', { job: legId }))
              onClose()
            }}
          >
            <Flag /> {t('pp.flag.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PROBLEMS: ProblemKind[] = ['breakdown', 'vehicleDelay', 'consigneeIssue', 'damageFound', 'other']

export function ProblemDialog({ legId, userId, onClose }: { legId: Id; userId: Id; onClose: () => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<ProblemKind>('vehicleDelay')
  const [text, setText] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp.problem.title', { job: legId })}</DialogTitle>
          <DialogDescription>{t('pp.problem.body')}</DialogDescription>
        </DialogHeader>
        <Field label={t('pp.problem.kind')} htmlFor="prob-kind">
          <NativeSelect id="prob-kind" value={kind} onChange={(e) => setKind(e.target.value as ProblemKind)}>
            {PROBLEMS.map((k) => (
              <option key={k} value={k}>
                {t(`pp.problem.kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('pp.problem.details')} htmlFor="prob-text" required>
          <textarea id="prob-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!text.trim()}
            onClick={() => {
              useDemoStore.getState().reportProblem(legId, kind, text.trim(), userId)
              toast.success(t('pp.problem.done'))
              onClose()
            }}
          >
            {t('pp.problem.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
