/**
 * PP-17 Hub operations — docs/02-partner-portal.md. Source §5.1 (Hub
 * Operations), §7 Steps 5 and 7, §3 (Type F storage is billable). The
 * supervisor's view of each hub today; scanning itself happens in the Partner
 * App (hub mode). Raise short / excess creates the same exception as PA-30.
 */
import { AlertTriangle, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { bagLabel, destinationName, hubItems } from '@shared/engines/hub'
import { hubSummary, STORAGE_RATE } from '@shared/engines/partnerOps'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Manifest } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { KpiTile } from '@shared/ui/KpiTile'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Chip } from '@shared/ui/StatusChip'
import { ManifestPrintButton } from '@apps/partner-app/ManifestPrint'
import { usePartnerSession } from './usePartnerSession'

const M_TONE = { open: 'neutral', closed: 'info', dispatched: 'success' } as const

export default function PP17HubOps() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const hubs = Object.values(data.hubs).filter((h) => h.partnerId === partner.id)
  const [hubId, setHubId] = useState(hubs[0]?.id ?? '')
  const [manifest, setManifest] = useState<Manifest>()
  const [raise, setRaise] = useState(false)

  if (!hubs.length) return <EmptyState icon={Warehouse} title={t('pp17.noHubs')} />
  const sum = hubSummary(data, hubId, now)
  const manifests = Object.values(data.manifests)
    .filter((m) => m.hubId === hubId)
    .sort((a, b) => b.id.localeCompare(a.id))
  const shortExcess = Object.values(data.exceptions).filter((x) => (x.type === 'short' || x.type === 'excess') && x.status !== 'resolved' && hubItems(data, hubId, now).some((i) => i.leg.id === x.legId || i.from.id === x.legId))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp17.title')}
        subtitle={t('pp17.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            {hubs.length > 1 && (
              <NativeSelect aria-label={t('pp17.hub')} value={hubId} onChange={(e) => setHubId(e.target.value)} className="w-56">
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button variant="outline" onClick={() => setRaise(true)}>
              <AlertTriangle /> {t('pp17.raise')}
            </Button>
          </div>
        }
        className="mb-0"
      />
      <p className="font-medium">{data.hubs[hubId]?.name}</p>
      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7" data-testid="hub-summary">
        <KpiTile label={t('pp17.k.expected')} value={String(sum.expected)} hint={t('pp17.pieces', { count: sum.expectedPieces })} />
        <KpiTile label={t('pp17.k.inScanned')} value={String(sum.inScanned)} />
        <KpiTile label={t('pp17.k.sorted')} value={String(sum.sorted)} />
        <KpiTile label={t('pp17.k.sealed')} value={String(sum.sealed)} />
        <KpiTile label={t('pp17.k.out')} value={String(sum.outScanned)} />
        <KpiTile label={t('pp17.k.dwell')} value={sum.dwellHours != null ? `${sum.dwellHours} h` : '—'} />
        <KpiTile label={t('pp17.k.shortExcess')} value={String(sum.shortExcess)} />
      </div>
      <p className="text-caption text-muted-foreground">{t('pp17.scanNote')}</p>

      {shortExcess.length > 0 && (
        <section className="rounded-xl border bg-card p-4 shadow-card" aria-label={t('pp17.shortExcess')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('pp17.shortExcess')}</h2>
          <ul className="flex flex-col gap-1 text-caption">
            {shortExcess.map((x) => (
              <li key={x.id}>
                <Chip tone="danger">{t(`pp17.kind.${x.type}`)}</Chip> <span className="tabular">{x.shipmentId}</span> · {formatDateTime(x.raisedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp17.manifests')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp17.manifests')}</h2>
        {manifests.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('pp17.noManifests')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="manifests">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp17.col.manifest')}</th>
                <th>{t('pp17.col.dest')}</th>
                <th>{t('pp17.col.bags')}</th>
                <th>{t('pp17.col.pieces')}</th>
                <th>{t('pp17.col.seal')}</th>
                <th>{t('pp17.col.vehicle')}</th>
                <th>{t('pp17.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {manifests.map((m) => (
                <tr key={m.id} className="border-b last:border-0" aria-label={m.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setManifest(m)}>
                      {m.id}
                    </button>
                  </td>
                  <td>{destinationName(data, m.destination, m.hubId)}</td>
                  <td className="tabular">{m.bagIds.length}</td>
                  <td className="tabular">{m.bagIds.reduce((n, id) => n + (data.bags[id]?.pieceIds.length ?? 0), 0)}</td>
                  <td className="tabular text-caption">{m.doorSeal ?? '—'}</td>
                  <td className="tabular text-caption">{m.vehicleId ? data.vehicles[m.vehicleId]?.regNo : '—'}</td>
                  <td>
                    <Chip tone={M_TONE[m.status]}>{t(`pp17.ms.${m.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-card" aria-label={t('pp17.storage')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('pp17.storage')}</h2>
        {sum.stored.length === 0 ? (
          <p className="text-muted-foreground">{t('pp17.noStorage')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-caption" data-testid="storage">
            {sum.stored.map((s) => (
              <li key={s.lr} className="tabular">
                {s.lr} · {t('pp17.days', { count: s.days })} · {formatINR(s.days * STORAGE_RATE)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-caption text-muted-foreground">{t('pp17.storageNote', { rate: formatINR(STORAGE_RATE) })}</p>
      </section>

      {manifest && (
        <Dialog open onOpenChange={(o) => !o && setManifest(undefined)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {manifest.id} · {destinationName(data, manifest.destination, manifest.hubId)}
              </DialogTitle>
            </DialogHeader>
            <ul className="flex flex-col gap-1 text-caption" data-testid="manifest-bags">
              {manifest.bagIds.map((id) => {
                const b = data.bags[id]
                return (
                  <li key={id} className={cn('flex justify-between gap-2 rounded border p-2')}>
                    <span className="font-medium">{b ? bagLabel(b) : id}</span>
                    <span className="tabular">
                      {t('pp17.pieces', { count: b?.pieceIds.length ?? 0 })} · {b?.sealNo ?? '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
            <DialogFooter>
              <ManifestPrintButton manifestId={manifest.id} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {raise && <RaiseDialog hubId={hubId} onClose={() => setRaise(false)} />}
    </div>
  )
}

function RaiseDialog({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const items = hubItems(data, hubId, now).filter((i) => i.stage !== 'expected')
  const [legId, setLegId] = useState(items[0]?.leg.id ?? '')
  const [kind, setKind] = useState<'short' | 'excess'>('short')
  const [pieces, setPieces] = useState<string[]>([])
  const [photo, setPhoto] = useState('')
  const item = items.find((i) => i.leg.id === legId)
  const reporter = Object.values(data.fieldStaff).find((s) => s.hubId === hubId) ?? Object.values(data.fieldStaff).find((s) => s.partnerId === data.hubs[hubId]?.partnerId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp17.raise')}</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-muted-foreground">{t('pp17.nothingAtHub')}</p>
        ) : (
          <>
            <Field label={t('pp17.shipment')} htmlFor="rx-leg" required>
              <NativeSelect id="rx-leg" value={legId} onChange={(e) => (setLegId(e.target.value), setPieces([]))}>
                {items.map((i) => (
                  <option key={i.leg.id} value={i.leg.id}>
                    {i.shipment.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('pp17.type')} htmlFor="rx-kind" required>
              <NativeSelect id="rx-kind" value={kind} onChange={(e) => setKind(e.target.value as 'short' | 'excess')}>
                <option value="short">{t('pp17.kind.short')}</option>
                <option value="excess">{t('pp17.kind.excess')}</option>
              </NativeSelect>
            </Field>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-caption font-medium">{t('pp17.piecesLabel')}</legend>
              {item?.shipment.pieces.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-caption">
                  <Checkbox checked={pieces.includes(p.id)} onCheckedChange={(v) => setPieces(v ? [...pieces, p.id] : pieces.filter((x) => x !== p.id))} /> <span className="tabular">{p.id}</span>
                </label>
              ))}
            </fieldset>
            <PhotoCapture label={t('pp17.photo')} caption={item?.shipment.id ?? ''} value={photo} onChange={setPhoto} idBase={`hub-${hubId}`} required />
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!item || !pieces.length || !photo || !reporter}
            onClick={() => {
              const id = useDemoStore.getState().reportHubException({ legId, staffId: reporter!.id, kind, pieceIds: pieces, photos: [photo], note: t('pp17.fromPortal') })
              if (id) toast.success(t('pp17.raised', { id }))
              onClose()
            }}
          >
            {t('pp17.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
