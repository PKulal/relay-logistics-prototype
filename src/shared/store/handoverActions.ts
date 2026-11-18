/**
 * Partner App hand-overs (PA-19 give, PA-20 receive). The giver's event only
 * shows a code; liability moves when the receiver confirms (source §2.2).
 */
import { nextLegOf, prevLegOf } from '@shared/engines/fieldTasks'
import { addHours } from '@shared/lib/time'
import { makeHandoverCode } from '@shared/sim/handover'
import type { DemoData, ExceptionKind, Id, IsoDateTime, ShipmentEvent, ShipmentException } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'

/** Hours the previous leg's partner has to investigate a short / seal / damage exception (source §10). */
export const INVESTIGATE_WITHIN_HOURS = 4

/** Exception ids are per shipment: EXC-000781-1, -2 … (`offset` for several raised at once). */
export function exceptionId(data: DemoData, shipmentId: Id, offset = 0): Id {
  const already = Object.values(data.exceptions).filter((x) => x.shipmentId === shipmentId).length
  return `EXC-${shipmentId.slice(-6)}-${already + offset + 1}`
}

/**
 * Where a hand-over from `fromLegId` stands: the latest code shown, and the
 * receiver's confirmation if it has happened.
 */
export function handoverState(data: DemoData, fromLegId: Id): { given?: ShipmentEvent; received?: ShipmentEvent } {
  const from = data.legs[fromLegId]
  if (!from) return {}
  const to = nextLegOf(data, from)
  const events = Object.values(data.events).filter((e) => e.shipmentId === from.shipmentId)
  const given = events.filter((e) => e.type === 'handoverGiven' && e.legId === fromLegId).sort((a, b) => a.at.localeCompare(b.at)).at(-1)
  const received = to ? events.find((e) => e.type === 'handoverReceived' && e.legId === to.id) : undefined
  return { given, received }
}

export interface HandoverGive {
  /** The giver's leg (e.g. the rider's first mile) */
  legId: Id
  staffId: Id
  pieceIds: Id[]
  sealNos?: string[]
  vehicleNo?: string
  photos: string[]
}

/** PA-19 "Show code": scan-out recorded, code shown for the receiver. */
export function giveHandover(data: DemoData, g: HandoverGive, at: IsoDateTime): DemoData {
  const leg = data.legs[g.legId]
  if (!leg || leg.status !== 'inProgress') return data
  const { given, received } = handoverState(data, g.legId)
  if (given && !received) return data // already waiting for the receiver
  const to = nextLegOf(data, leg)
  const ev: ShipmentEvent = {
    id: eventIdFactory(data, leg.shipmentId)(),
    shipmentId: leg.shipmentId,
    legId: leg.id,
    type: 'handoverGiven',
    at,
    by: g.staffId,
    app: 'partnerApp',
    pieceIds: g.pieceIds,
    sealNos: g.sealNos?.length ? g.sealNos : undefined,
    vehicleNo: g.vehicleNo || undefined,
    photos: g.photos,
    counterpartStaffId: to?.staffId,
    handoverCode: makeHandoverCode(leg.id, at),
  }
  return applyEvents(data, [ev], at)
}

export interface HandoverReceive {
  /** The receiver's leg (e.g. the origin hub job) */
  legId: Id
  staffId: Id
  code: string
  /** Pieces counted in */
  pieceIds: Id[]
  /** Seals that did not match or were broken */
  brokenSeals: string[]
  damagedPieceIds: Id[]
  photos: string[]
}

/** Problems PA-20 finds: short / excess from the count, seal and damage from the checks. */
export function receiveExceptions(expected: Id[], r: Pick<HandoverReceive, 'pieceIds' | 'brokenSeals' | 'damagedPieceIds'>) {
  const found: { kind: ExceptionKind; pieceIds: Id[]; note: string }[] = []
  const short = expected.filter((p) => !r.pieceIds.includes(p))
  const excess = r.pieceIds.filter((p) => !expected.includes(p))
  if (short.length) found.push({ kind: 'short', pieceIds: short, note: `${r.pieceIds.length - excess.length} of ${expected.length} received` })
  if (excess.length) found.push({ kind: 'excess', pieceIds: excess, note: `${excess.length} not on the hand-over` })
  if (r.brokenSeals.length) found.push({ kind: 'sealMismatch', pieceIds: [], note: `Seal ${r.brokenSeals.join(', ')} broken or not matching` })
  if (r.damagedPieceIds.length) found.push({ kind: 'damage', pieceIds: r.damagedPieceIds, note: `${r.damagedPieceIds.length} damaged` })
  return found
}

/**
 * PA-20 "Accept" / "Accept with exception": the receiver confirms with the code.
 * The previous leg becomes Handed Over and the receiving job starts. Any problem
 * puts the goods on hold (receiving leg → exception) and opens an investigation
 * on the previous leg, due within 4 hours.
 */
export function receiveHandover(data: DemoData, r: HandoverReceive, at: IsoDateTime): DemoData {
  const leg = data.legs[r.legId]
  const prev = leg ? prevLegOf(data, leg) : undefined
  if (!leg || !prev) return data
  const { given, received } = handoverState(data, prev.id)
  if (!given || received || given.handoverCode !== r.code) return data

  const newId = eventIdFactory(data, leg.shipmentId)
  const events: ShipmentEvent[] = [
    {
      id: newId(),
      shipmentId: leg.shipmentId,
      legId: leg.id,
      type: 'handoverReceived',
      at,
      by: r.staffId,
      app: 'partnerApp',
      pieceIds: r.pieceIds,
      sealNos: given.sealNos,
      photos: r.photos,
      counterpartStaffId: given.by,
    },
  ]
  const problems = receiveExceptions(given.pieceIds ?? [], r)
  const exceptions: Record<Id, ShipmentException> = {}
  problems.forEach((p, i) => {
    events.push({
      id: newId(),
      shipmentId: leg.shipmentId,
      legId: leg.id,
      type: 'exceptionReported',
      at,
      by: r.staffId,
      app: 'partnerApp',
      exceptionKind: p.kind,
      pieceIds: p.pieceIds,
      photos: r.photos,
      counterpartStaffId: given.by,
      note: p.note,
    })
    const id = exceptionId(data, leg.shipmentId, i)
    exceptions[id] = {
      id,
      shipmentId: leg.shipmentId,
      legId: prev.id, // investigated on the leg that handed over
      type: p.kind,
      raisedAt: at,
      actionDueAt: addHours(at, INVESTIGATE_WITHIN_HOURS),
      ownerPartnerId: prev.partnerId,
      status: 'open',
      customerConfirmed: false,
    }
  })
  const next = applyEvents(data, events, at)
  return { ...next, exceptions: { ...next.exceptions, ...exceptions } }
}
