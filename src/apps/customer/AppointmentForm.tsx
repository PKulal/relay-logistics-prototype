/**
 * Delivery appointment form (source §7 Step 8: "Consignee books slot … uploads
 * gate pass"). Used by the public tracking page (CP-18) and by the shipper's
 * "Change delivery slot" (CP-17).
 */
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateLong } from '@shared/lib/format'
import { addDaysToDate } from '@shared/lib/time'
import { APPOINTMENT_SLOTS, needsGatePass, type AppointmentInput } from '@shared/store/appointmentActions'
import type { Consignee, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

export function AppointmentForm({ s, consignee, onSubmit, submitLabel, compact }: { s: Shipment; consignee: Consignee; onSubmit: (a: AppointmentInput) => void; submitLabel: string; /** One column (inside the phone frame) */ compact?: boolean }) {
  const { t } = useTranslation()
  const a = s.appointment
  // From the ETA date onward, a week of dates
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToDate(s.eta, i))
  const [date, setDate] = useState(a?.date && a.date >= s.eta ? a.date : s.eta)
  const [slot, setSlot] = useState(a?.from ?? APPOINTMENT_SLOTS[1].from)
  const [dock, setDock] = useState(a?.dock ?? '')
  const [contactName, setContactName] = useState(a?.contactName ?? consignee.contact)
  const [contactMobile, setContactMobile] = useState(a?.contactMobile ?? consignee.mobile)
  const [gatePass, setGatePass] = useState(a?.gatePass ?? '')
  const [tried, setTried] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const gateRequired = needsGatePass(consignee)
  const mobileOk = /^\d{10}$/.test(contactMobile.replace(/\s/g, ''))
  const errors = {
    contactName: !contactName.trim() ? t('cp18.err.required') : undefined,
    contactMobile: !mobileOk ? t('cp18.err.mobile') : undefined,
    gatePass: gateRequired && !gatePass ? t('cp18.err.gatePass') : undefined,
  }
  const valid = !errors.contactName && !errors.contactMobile && !errors.gatePass

  const submit = () => {
    setTried(true)
    if (!valid) return
    const s0 = APPOINTMENT_SLOTS.find((x) => x.from === slot)!
    onSubmit({ date, from: s0.from, to: s0.to, dock, contactName, contactMobile, gatePass: gatePass || undefined })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        <Field label={t('cp18.date')} htmlFor="ap-date" required>
          <NativeSelect id="ap-date" value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDateLong(d)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp18.slot')} htmlFor="ap-slot" required>
          <NativeSelect id="ap-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {APPOINTMENT_SLOTS.map((x) => (
              <option key={x.from} value={x.from}>
                {x.from}–{x.to}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp18.dock')} htmlFor="ap-dock">
          <Input id="ap-dock" value={dock} onChange={(e) => setDock(e.target.value)} placeholder="Dock 2" />
        </Field>
        <Field label={t('cp18.contactName')} htmlFor="ap-name" required error={tried ? errors.contactName : undefined}>
          <Input id="ap-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label={t('cp18.contactMobile')} htmlFor="ap-mob" required error={tried ? errors.contactMobile : undefined}>
          <Input id="ap-mob" inputMode="tel" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} />
        </Field>
        <Field label={t('cp18.gatePass')} required={gateRequired} error={tried ? errors.gatePass : undefined} hint={gateRequired ? t('cp18.gatePassHint') : undefined}>
          {/* SIMULATED upload: only the file name is kept */}
          <input ref={file} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setGatePass(e.target.files?.[0]?.name ?? '')} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}>
              <Upload /> {gatePass ? t('cp18.replace') : t('cp18.upload')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setGatePass(`gatepass_${s.id.slice(-4)}.pdf`)}>
              {t('cp18.sampleGatePass')}
            </Button>
            {gatePass && <span className="tabular text-caption">{gatePass}</span>}
            <SimulatedTag />
          </div>
        </Field>
      </div>
      <Button onClick={submit} className="self-start">
        {submitLabel}
      </Button>
    </div>
  )
}
