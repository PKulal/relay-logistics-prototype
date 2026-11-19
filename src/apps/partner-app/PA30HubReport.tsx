/**
 * PA-30 Short, excess and damage report — docs/03-partner-app.md. Source §7
 * Step 7 (seal check; short / excess flagged instantly), §10 Step 3 (seal
 * mismatch / short pieces → hold, photo evidence, investigation on the
 * previous leg, 4 hours). SIMULATED: camera, scanner.
 */
import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useDemoStore } from '@shared/store'
import { HUB_REPORT_KINDS, type HubReportKind } from '@shared/store/exceptionActions'
import { AccessDenied } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Card, Choice } from './FieldUi'
import { useHub } from './useHub'

const MAX_PHOTOS = 5

export default function PA30HubReport() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff, hubId, items } = useHub()
  const here = items.filter((i) => i.stage !== 'expected')
  const [kind, setKind] = useState<HubReportKind>()
  const [legId, setLegId] = useState(here[0]?.leg.id ?? '')
  const [pieces, setPieces] = useState<string[]>([])
  const [excess, setExcess] = useState('')
  const [photos, setPhotos] = useState<string[]>([''])
  const [note, setNote] = useState('')
  if (!hubId) return <div className="p-4"><AccessDenied /></div>
  const item = here.find((i) => i.leg.id === legId)
  const pieceIds = kind === 'excess' ? (excess.trim() ? [excess.trim().toUpperCase()] : []) : pieces
  const taken = photos.filter(Boolean)
  const ready = !!kind && !!item && pieceIds.length > 0 && taken.length > 0

  const submit = () => {
    const id = useDemoStore.getState().reportHubException({ legId, staffId: staff.id, kind: kind!, pieceIds, photos: taken, note })
    if (!id) return toast.error(t('pa30.failed'))
    toast.success(t('pa30.done', { id }))
    navigate('/app/hub/exceptions')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate('/app/hub/exceptions')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <h1 className="font-heading text-[22px] font-bold">{t('pa30.title')}</h1>

      <Card title={t('pa30.type')}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('pa30.type')}>
          {HUB_REPORT_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn('min-h-12 rounded-xl border-2 font-semibold', kind === k && 'border-status-danger bg-status-danger-bg text-status-danger')}>
              {t(`hubx.kind.${k}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('pa30.shipment')}>
        {here.length === 0 ? (
          <p className="text-muted-foreground">{t('pa30.noShipments')}</p>
        ) : (
          <select
            aria-label={t('pa30.shipment')}
            value={legId}
            onChange={(e) => {
              setLegId(e.target.value)
              setPieces([])
            }}
            className="tabular h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px]"
          >
            {here.map((i) => (
              <option key={i.leg.id} value={i.leg.id}>
                {i.shipment.id} · {i.pieceIds.length} {t('pa30.pcs')}
              </option>
            ))}
          </select>
        )}
      </Card>

      {item && kind && (
        <Card title={kind === 'excess' ? t('pa30.excessPiece') : t('pa30.pieces')}>
          {kind === 'excess' ? (
            <input aria-label={t('pa30.excessPiece')} placeholder="LGS-…" value={excess} onChange={(e) => setExcess(e.target.value)} className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
          ) : (
            <div role="group" aria-label={t('pa30.pieces')}>
              {item.shipment.pieces.map((p) => (
                <Choice key={p.id} checkbox checked={pieces.includes(p.id)} onClick={() => setPieces(pieces.includes(p.id) ? pieces.filter((x) => x !== p.id) : [...pieces, p.id])} label={p.id} />
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title={t('pa30.photos', { max: MAX_PHOTOS })}>
        <div className="flex flex-col gap-2">
          {photos.map((v, n) => (
            <PhotoCapture key={n} label={t('pa30.photoN', { n: n + 1 })} caption={kind ? t(`hubx.kind.${kind}`) : t('pa30.title')} value={v} onChange={(x) => setPhotos(photos.map((p, i) => (i === n ? x : p)))} idBase={`${legId}-hubx-${n}`} required={n === 0} />
          ))}
          {photos.length < MAX_PHOTOS && photos.at(-1) && (
            <button type="button" onClick={() => setPhotos([...photos, ''])} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed font-semibold">
              <Plus className="size-5" aria-hidden /> {t('pa30.addPhoto')}
            </button>
          )}
        </div>
      </Card>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t('pa30.note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('pa30.notePh')} className="rounded-xl border bg-background p-3 text-[16px]" />
      </label>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={submit} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          {t('pa30.submit')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa30.todo')}</p>}
      </div>
    </div>
  )
}
