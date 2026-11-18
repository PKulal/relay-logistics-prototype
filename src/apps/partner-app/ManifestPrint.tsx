/**
 * Printable manifest (PA-28 "Print manifest"). The hub printer is assumed; the
 * browser print dialog stands in for it (and for "share PDF").
 */
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { bagLabel, destinationName } from '@shared/engines/hub'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatKg, formatTime } from '@shared/lib/format'
import { PrintArea } from '@shared/ui/PrintArea'

export function ManifestPrintButton({ manifestId }: { manifestId: string }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const m = data.manifests[manifestId]
  if (!m) return null
  const hub = data.hubs[m.hubId]
  const trip = m.tripId ? data.trips[m.tripId] : undefined
  const bags = m.bagIds.map((id) => data.bags[id])
  return (
    <>
      <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 font-semibold text-primary">
        <Printer className="size-4" aria-hidden /> {t('pa28.print')}
      </button>
      <PrintArea>
        <div className="p-8 text-[12px]">
          <h1 className="text-[20px] font-bold">
            {t('pa28.printTitle')} {m.id}
          </h1>
          <p>
            {hub.name} → {destinationName(data, m.destination, m.hubId)}
            {trip ? ` · ${trip.id} · ${data.vehicles[trip.vehicleId]?.regNo} · ${t('pa28.departs', { time: formatTime(trip.departAt) })}` : ''}
          </p>
          <p>{t('pa28.printedAt', { at: formatDateTime(now) })}</p>
          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">{t('pa28.bag')}</th>
                <th>{t('pa28.seal')}</th>
                <th>{t('pa28.weight')}</th>
                <th>{t('pa28.contents')}</th>
              </tr>
            </thead>
            <tbody>
              {bags.map((b) => (
                <tr key={b.id} className="border-b align-top">
                  <td className="py-1 font-semibold">{bagLabel(b)}</td>
                  <td>{b.sealNo ?? '—'}</td>
                  <td>{b.weightKg ? formatKg(b.weightKg) : '—'}</td>
                  <td>{b.pieceIds.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4">{t('pa28.printTotal', { bags: bags.length, pieces: bags.reduce((n, b) => n + b.pieceIds.length, 0) })}</p>
        </div>
      </PrintArea>
    </>
  )
}
