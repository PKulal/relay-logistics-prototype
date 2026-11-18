/**
 * PP-13 Job detail — docs/02-partner-portal.md §6.4.
 * Everything about one leg: what, from where to where, by when, the partners
 * before and after, pieces, documents, seal, staff and the leg's timeline.
 * The customer's price is never shown to partners.
 */
import { ArrowLeft, ArrowRight, Check, Flag, MapPin, PhoneCall, Printer, TriangleAlert, UserMinus, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LrDocument, PieceLabel } from '@shared/docs/ShipmentDocs'
import { JOB_TYPE, jobEnds, jobSpecials, neighbours } from '@shared/engines/partnerJobs'
import { legSla } from '@shared/engines/sla'
import { sortEvents } from '@shared/engines/status'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import { person } from '@shared/people'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { NotFound } from '@shared/ui/Page'
import { PrintArea } from '@shared/ui/PrintArea'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { SlaBadge } from '@shared/ui/SlaBadge'
import { Chip, LegStatusChip } from '@shared/ui/StatusChip'
import { AcceptByChip, FlagDialog, ProblemDialog, SpecialIcons } from './JobBits'
import { acceptBy } from '@shared/engines/partnerJobs'
import { usePartnerSession } from './usePartnerSession'

export default function PP13JobDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { jobId = '' } = useParams()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [dialog, setDialog] = useState<'flag' | 'problem' | null>(null)
  const [printMode, setPrintMode] = useState<'lr' | 'labels' | null>(null)
  const leg = data.legs[jobId]

  useEffect(() => {
    if (!printMode) return
    const done = () => setPrintMode(null)
    window.addEventListener('afterprint', done, { once: true })
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [printMode])

  // A partner only sees its own jobs
  if (!leg || leg.partnerId !== partner.id) return <NotFound />

  const s = data.shipments[leg.shipmentId]
  const ends = jobEnds(data, leg, s)
  const { prev, next } = neighbours(data, leg, s)
  const events = sortEvents(Object.values(data.events).filter((e) => e.legId === leg.id))
  const seals = [...new Set(Object.values(data.events).filter((e) => e.shipmentId === s.id).flatMap((e) => e.sealNos ?? []))]
  const staff = leg.staffId ? data.fieldStaff[leg.staffId] : undefined
  const vehicle = leg.vehicleId ? data.vehicles[leg.vehicleId] : undefined
  const canAct = user.role !== 'finance'
  const ownCustomerLeg = leg.type === 'firstMile' || leg.type === 'lastMile'

  return (
    <div className="flex flex-col gap-6">
      <Link to="/partner/jobs" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('pp13.back')}
      </Link>

      <header className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tabular font-heading text-page-title font-bold">{leg.id}</h1>
          <LegStatusChip status={leg.status} />
          {leg.status === 'offered' ? <AcceptByChip acceptBy={acceptBy(data, leg)} now={now} /> : <SlaBadge state={legSla(leg, now)} dueAt={leg.slaDueAt} now={now} />}
        </div>
        <p className="text-muted-foreground">
          {t(`pp.jobType.${JOB_TYPE[leg.type]}`)} · {s.id} · {t('pp13.legOf', { n: leg.seq, total: s.legIds.length })} · {t('pp13.payout')} <span className="tabular font-semibold text-foreground">{formatINR(leg.cost)}</span>
        </p>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            {leg.status === 'offered' && (
              <>
                <Button
                  onClick={() => {
                    useDemoStore.getState().acceptLegs([leg.id], user.id)
                    toast.success(t('pp12.accepted', { count: 1 }))
                  }}
                >
                  <Check /> {t('pp12.accept')}
                </Button>
                <Button variant="outline" onClick={() => setDialog('flag')}>
                  <Flag /> {t('pp12.flagShort')}
                </Button>
              </>
            )}
            {(leg.status === 'accepted' || leg.status === 'assigned') && (
              <Button onClick={() => navigate(`/partner/jobs/assign?ids=${leg.id}`)}>
                <UserPlus /> {leg.status === 'accepted' ? t('pp12.assign') : t('pp12.reassign')}
              </Button>
            )}
            {leg.status === 'assigned' && (
              <Button
                variant="outline"
                onClick={() => {
                  useDemoStore.getState().unassignLeg(leg.id, user.id)
                  toast.success(t('pp13.unassigned'))
                }}
              >
                <UserMinus /> {t('pp13.unassign')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog('problem')}>
              <TriangleAlert /> {t('pp13.reportProblem')}
            </Button>
            <Button variant="outline" onClick={() => toast.success(t('pp13.callPlaced'))}>
              <PhoneCall /> {t('pp13.call')}
            </Button>
          </div>
        )}
      </header>

      {/* Pick from → hand to */}
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <EndCard title={leg.type === 'firstMile' ? t('pp13.pickFrom') : t('pp13.from')} name={ends.from.name} place={ends.from.place} pincode={ends.from.pincode} partner={prev?.shortName} partnerLabel={t('pp13.prevPartner')} />
        <ArrowRight className="hidden self-center text-muted-foreground md:block" aria-hidden />
        <EndCard title={leg.type === 'lastMile' ? t('pp13.deliverTo') : t('pp13.handTo')} name={ends.to.name} place={ends.to.place} pincode={ends.to.pincode} partner={next?.shortName} partnerLabel={t('pp13.nextPartner')} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Fact label={t('pp13.window')}>
          {formatDateTime(leg.window.from)} – {leg.window.to.slice(11, 16)}
        </Fact>
        <Fact label={t('pp13.assigned')}>{staff ? `${staff.name}${vehicle ? ` · ${vehicle.regNo}` : ''}` : <span className="text-muted-foreground">{t('pp13.notAssigned')}</span>}</Fact>
        <Fact label={t('pp13.seal')}>{seals.length ? seals.join(', ') : <span className="text-muted-foreground">{t('pp13.sealLater')}</span>}</Fact>
        <Fact label={t('pp13.special')}>
          <SpecialIcons specials={jobSpecials(data, leg, s)} />
          {leg.type === 'lastMile' && s.paymentMode === 'cod' && <span className="tabular ml-2">{formatINR(s.codAmount ?? 0)}</span>}
        </Fact>
      </div>

      {/* Pieces */}
      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="pieces-h">
        <h2 id="pieces-h" className="border-b px-5 py-3 text-section">
          {t('pp13.pieces', { count: s.pieces.length })} · {formatKg(s.weights.actual)} · {t('weight.chargeable')} {formatKg(s.weights.verifiedChargeable ?? s.weights.chargeable)}
        </h2>
        <table className="w-full text-table">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-semibold">{t('pp13.piece')}</th>
              <th className="px-4 py-2 font-semibold">{t('pp13.booked')}</th>
              <th className="px-4 py-2 font-semibold">{t('pp13.verified')}</th>
              <th className="px-4 py-2 font-semibold">{t('pp13.scan')}</th>
            </tr>
          </thead>
          <tbody>
            {s.pieces.map((p) => {
              const scanned = events.some((e) => e.pieceIds?.includes(p.id))
              return (
                <tr key={p.id} className="border-t">
                  <td className="tabular px-4 py-2">{p.id}</td>
                  <td className="tabular px-4 py-2">
                    {p.l}×{p.b}×{p.h} cm · {formatKg(p.weight)}
                  </td>
                  <td className="tabular px-4 py-2">{p.verifiedDims ? `${p.verifiedDims.l}×${p.verifiedDims.b}×${p.verifiedDims.h} cm · ${formatKg(p.verifiedWeight ?? p.weight)}` : '—'}</td>
                  <td className="px-4 py-2">{p.condition === 'missing' ? <Chip tone="danger">{t('pp13.missing')}</Chip> : scanned ? <Chip tone="success">{t('pp13.scanned')}</Chip> : <Chip tone="neutral">{t('pp13.notScanned')}</Chip>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documents */}
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="docs-h">
          <h2 id="docs-h" className="mb-3 text-card-title">
            {t('pp13.documents')}
          </h2>
          <ul className="flex flex-col gap-2 text-body">
            <li className="flex items-center justify-between gap-2">
              {t('erp03.doc.lr')} · {s.id}
              <Button variant="outline" size="xs" onClick={() => setPrintMode('lr')}>
                <Printer /> {t('erp03.print')}
              </Button>
            </li>
            <li className="flex items-center justify-between gap-2">
              {t('cp14.labels', { count: s.pieces.length })}
              <Button variant="outline" size="xs" onClick={() => setPrintMode('labels')}>
                <Printer /> {t('erp03.print')}
              </Button>
            </li>
            {ownCustomerLeg && <li>{t('erp03.doc.invoice')} · {s.invoice.no}</li>}
            <li>{s.ewb ? `${t('erp03.doc.ewb')} · ${s.ewb.no} · ${t('cp14.ewbValid', { date: formatDate(s.ewb.validTill) })}` : `${t('erp03.doc.ewb')} · ${t('cp14.ewbNone')}`}</li>
          </ul>
        </section>

        {/* Timeline */}
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="tl-h">
          <h2 id="tl-h" className="mb-3 text-card-title">
            {t('pp13.timeline')}
          </h2>
          <ol className="flex flex-col gap-2">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="text-body">
                <span className="font-medium">{t(`event.${e.type}`)}</span>
                {e.note === 'API' && <span className="ml-1 text-caption text-muted-foreground">({t('pp13.viaApi')})</span>}
                {e.assigneeStaffId && <span className="text-muted-foreground"> → {person(data, e.assigneeStaffId).name}</span>}
                <span className="tabular block text-caption text-muted-foreground">
                  {formatDateTime(e.at)} · {person(data, e.by).name}
                </span>
              </li>
            ))}
          </ol>
          {events.some((e) => e.note === 'API') && <SimulatedTag className="mt-2" />}
        </section>
      </div>

      {dialog === 'flag' && <FlagDialog legId={leg.id} userId={user.id} onClose={() => setDialog(null)} />}
      {dialog === 'problem' && <ProblemDialog legId={leg.id} userId={user.id} onClose={() => setDialog(null)} />}
      {printMode && (
        <PrintArea>
          <style>{'@page { size: A4; margin: 10mm }'}</style>
          {printMode === 'lr' ? (
            <LrDocument data={data} s={s} showPrice={false} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {s.pieces.map((p, i) => (
                <PieceLabel key={p.id} data={data} s={s} index={i} />
              ))}
            </div>
          )}
        </PrintArea>
      )}
    </div>
  )
}

function EndCard({ title, name, place, pincode, partner, partnerLabel }: { title: string; name: string; place: string; pincode?: string; partner?: string; partnerLabel: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <p className="mt-1 font-semibold">{name}</p>
      <p className="flex items-start gap-1 text-caption text-muted-foreground">
        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {place} {pincode}
      </p>
      {partner && (
        <p className="mt-2 text-caption">
          {partnerLabel}: <span className="font-medium">{partner}</span>
        </p>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  )
}
