/**
 * CP-18 / CP-17: the consignee (or the shipper) books or changes the delivery
 * slot (source §7 Step 8: "Consignee books slot on WhatsApp … uploads gate
 * pass; reminders to last-mile partner"). The last-mile job moves to the slot.
 */
import { ist } from '@shared/lib/time'
import type { Consignee, DemoData, Id, IsoDate, IsoDateTime, Shipment } from '@shared/types'
import { audit } from './erpActions'

export interface AppointmentInput {
  date: IsoDate
  from: string
  to: string
  dock?: string
  contactName: string
  contactMobile: string
  /** Uploaded gate pass file name (SIMULATED upload) */
  gatePass?: string
}

/** Slots offered to the consignee (CP-18). */
export const APPOINTMENT_SLOTS = [
  { from: '09:00', to: '11:00' },
  { from: '11:00', to: '13:00' },
  { from: '14:00', to: '16:00' },
  { from: '16:00', to: '18:00' },
]

/** DCs and modern trade need a gate pass (CP-18). */
export const needsGatePass = (c: Consignee) => c.category === 'dc' || c.category === 'modernTrade'

/** The slot can be booked or changed until the shipment goes out for delivery. */
export const canBookSlot = (s: Shipment) => s.addOns.appointment && ['booked', 'pickedUp', 'atOriginHub', 'inTransit', 'atDestinationHub', 'undelivered'].includes(s.status)

/**
 * Save the slot. `by` is the customer user, or "consignee" from the public page.
 * The last-mile partner and the rider get a reminder.
 */
export function bookAppointment(data: DemoData, lr: Id, a: AppointmentInput, by: Id, at: IsoDateTime): DemoData {
  const s = data.shipments[lr]
  if (!s || !canBookSlot(s)) return data
  const appointment = { date: a.date, from: a.from, to: a.to, dock: a.dock?.trim() || undefined, contactName: a.contactName.trim(), contactMobile: a.contactMobile.trim(), gatePass: a.gatePass, confirmed: true, bookedAt: at }
  const last = s.legIds.map((id) => data.legs[id]).find((l) => l.type === 'lastMile')
  let next: DemoData = { ...data, shipments: { ...data.shipments, [lr]: { ...s, appointment, updatedAt: at } } }
  if (last) {
    const window = { from: ist(a.date, a.from), to: ist(a.date, a.to) }
    next = { ...next, legs: { ...next.legs, [last.id]: { ...last, window, slaDueAt: window.to, updatedAt: at } } }
    // Reminders to the last-mile partner's office and the rider (SIMULATED push)
    const body = `${lr}: ${a.date} ${a.from}–${a.to}${appointment.dock ? ` · ${appointment.dock}` : ''}`
    const notifications = { ...next.notifications }
    const add = (audience: (typeof notifications)[string]['audience'], link: string) => {
      const id = `NTF-${String(Object.keys(notifications).length + 1).padStart(5, '0')}`
      notifications[id] = { id, audience, title: 'Appointment booked', body, link, at, read: false }
    }
    add({ app: 'partnerPortal', partnerId: last.partnerId }, `/partner/jobs/${last.id}`)
    if (last.staffId) add({ app: 'partnerApp', userId: last.staffId }, `/app/run/${last.id}`)
    next = { ...next, notifications }
  }
  return audit(next, { userId: by, app: 'customer', action: 'appointment.book', recordId: lr, at, before: s.appointment, after: appointment })
}
