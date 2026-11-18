/**
 * One-click actions on a shipment (ERP spec §11.1 "One-Click Actions"; ERP-03, ERP-05).
 * Message customer, masked call and e-way bill actions are SIMULATED integrations.
 * Reassign leg (ERP-08) and Open claim (ERP-37) arrive in Phase 4.
 */
import { FileClock, MessageSquare, MoreHorizontal, PhoneCall, Repeat, ShieldAlert, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDayShort } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { MessageTemplate } from '@shared/store/erpActions'
import type { Id, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/ui/dropdown-menu'
import { Field } from '@shared/ui/FormField'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useErpSession } from './useErpSession'

type Open = null | 'message' | 'call' | 'extend' | 'partB'

/** Row menu (job board) or a button bar (Shipment 360). */
export function ShipmentActions({ shipment, partnerId, variant = 'menu' }: { shipment: Shipment; partnerId?: Id; variant?: 'menu' | 'bar' }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Open>(null)
  const { user } = useErpSession()
  const data = useData((d) => d)
  const partner = partnerId ? data.partners[partnerId] : undefined

  const items = [
    { key: 'reassign', icon: Repeat, label: t('erpActions.reassign'), disabled: true, hint: t('toolbar.comingInPhase', { phase: 4 }) },
    { key: 'message', icon: MessageSquare, label: t('erpActions.message'), onClick: () => setOpen('message') },
    { key: 'call', icon: PhoneCall, label: t('erpActions.call'), disabled: !partner, onClick: () => setOpen('call') },
    { key: 'claim', icon: ShieldAlert, label: t('erpActions.claim'), disabled: true, hint: t('toolbar.comingInPhase', { phase: 4 }) },
    { key: 'extend', icon: FileClock, label: t('erpActions.extendEwb'), disabled: !shipment.ewb, onClick: () => setOpen('extend') },
    { key: 'partB', icon: Truck, label: t('erpActions.partB'), disabled: !shipment.ewb || shipment.ewb.partBUpdated, onClick: () => setOpen('partB') },
  ]

  return (
    <>
      {variant === 'menu' ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('erpActions.menu', { lr: shipment.id })} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {items.map((it, i) => (
              <div key={it.key}>
                {i === 4 && <DropdownMenuSeparator />}
                <DropdownMenuItem disabled={it.disabled} onSelect={() => it.onClick?.()} title={it.hint}>
                  <it.icon /> {it.label}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Button key={it.key} variant="outline" size="sm" disabled={it.disabled} onClick={it.onClick} title={it.hint}>
              <it.icon /> {it.label}
            </Button>
          ))}
        </div>
      )}

      {open === 'message' && <MessageDialog shipment={shipment} onClose={() => setOpen(null)} />}
      {open === 'call' && partner && <CallDialog shipment={shipment} partnerId={partner.id} onClose={() => setOpen(null)} />}
      <ConfirmDialog
        open={open === 'extend'}
        onOpenChange={(o) => !o && setOpen(null)}
        title={t('erpActions.extendTitle')}
        body={shipment.ewb ? t('erpActions.extendBody', { no: shipment.ewb.no, date: formatDate(shipment.ewb.validTill) }) : ''}
        confirmLabel={t('erpActions.extendConfirm')}
        onConfirm={() => {
          useDemoStore.getState().extendEwayBill(shipment.id, user.id)
          const till = useDemoStore.getState().data.shipments[shipment.id].ewb!.validTill
          toast.success(t('erpActions.extendDone', { date: formatDate(till) }))
        }}
      />
      <ConfirmDialog
        open={open === 'partB'}
        onOpenChange={(o) => !o && setOpen(null)}
        title={t('erpActions.partBTitle')}
        body={t('erpActions.partBBody')}
        confirmLabel={t('erpActions.partBConfirm')}
        onConfirm={() => {
          useDemoStore.getState().updatePartB(shipment.id, user.id)
          toast.success(t('erpActions.partBDone'))
        }}
      />
    </>
  )
}

const TEMPLATES: MessageTemplate[] = ['delay', 'pickupReschedule', 'appointment', 'general']

function MessageDialog({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const customer = data.customers[shipment.customerId]
  const [template, setTemplate] = useState<MessageTemplate>('delay')
  const fill = (tpl: MessageTemplate) => t(`erpActions.templates.${tpl}.body`, { lr: shipment.id, eta: formatDayShort(shipment.eta) })
  const [body, setBody] = useState(() => fill('delay'))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('erpActions.messageTitle', { company: customer.shortName })}</DialogTitle>
          <DialogDescription>
            {t('erpActions.messageVia')} <SimulatedTag />
          </DialogDescription>
        </DialogHeader>
        <Field label={t('erpActions.template')} htmlFor="msg-tpl">
          <NativeSelect
            id="msg-tpl"
            value={template}
            onChange={(e) => {
              const tpl = e.target.value as MessageTemplate
              setTemplate(tpl)
              setBody(fill(tpl))
            }}
          >
            {TEMPLATES.map((tpl) => (
              <option key={tpl} value={tpl}>
                {t(`erpActions.templates.${tpl}.name`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('erpActions.messageBody')} htmlFor="msg-body">
          <textarea
            id="msg-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!body.trim()}
            onClick={() => {
              useDemoStore.getState().messageCustomer(shipment.id, template, body.trim(), user.id)
              toast.success(t('erpActions.messageSent', { company: customer.shortName }))
              onClose()
            }}
          >
            <MessageSquare /> {t('erpActions.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CallDialog({ shipment, partnerId, onClose }: { shipment: Shipment; partnerId: Id; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const partner = useData((d) => d.partners[partnerId])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('erpActions.callTitle', { partner: partner.shortName })}</DialogTitle>
          <DialogDescription>
            {t('erpActions.callBody')} <SimulatedTag />
          </DialogDescription>
        </DialogHeader>
        <p className="tabular rounded-lg bg-gray-50 p-3 text-center font-heading text-section">+91 80 4718 •••• </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              useDemoStore.getState().logMaskedCall(shipment.id, partnerId, user.id)
              toast.success(t('erpActions.callPlaced', { partner: partner.shortName }))
              onClose()
            }}
          >
            <PhoneCall /> {t('erpActions.callNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
