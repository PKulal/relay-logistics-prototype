/**
 * CP-37 Help and support tickets — docs/01-customer-portal.md. Source §11
 * Dept 4 (Customer Success tickets); §9 Auto-Ticket ("ticket cannot close
 * without customer confirmation"). Replies from ERP-39 appear in the thread;
 * a Logisco reply waits for the customer ("Waiting for you"). Attachments are
 * SIMULATED (file name only).
 */
import { CircleHelp, Paperclip, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Ticket, TicketCategory } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useCustomerSession } from './useCustomerSession'

const CATEGORIES: TicketCategory[] = ['shipment', 'billing', 'pickup', 'account', 'integration', 'other']
const STATUS_TONE: Record<Ticket['status'], Tone> = { open: 'warning', inProgress: 'info', waiting: 'danger', resolved: 'success', closed: 'neutral' }
const MAX_MB = 5

const lastUpdate = (x: Ticket) => x.thread[x.thread.length - 1]?.at ?? x.createdAt ?? ''

export default function CP37Help() {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const tickets = useData((d) => d.tickets)
  const [params, setParams] = useSearchParams()
  const open = tickets[params.get('ticket') ?? '']
  const newCat = params.get('new')
  const mine = Object.values(tickets)
    .filter((x) => x.customerId === customer.id && x.app === 'customer')
    .sort((a, b) => lastUpdate(b).localeCompare(lastUpdate(a)))

  if (open && open.customerId === customer.id) return <TicketDetail ticket={open} onBack={() => setParams({})} />
  if (newCat !== null) return <RaiseTicket category={(CATEGORIES.find((c) => c === newCat) ?? 'shipment') as TicketCategory} lr={params.get('lr') ?? ''} onDone={(id) => setParams(id ? { ticket: id } : {})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp37.title')}
        subtitle={t('cp37.subtitle', { count: mine.filter((x) => x.status !== 'closed').length })}
        actions={
          <Button onClick={() => setParams({ new: 'shipment' })}>
            <Plus /> {t('cp37.raise')}
          </Button>
        }
        className="mb-0"
      />
      {mine.length === 0 ? (
        <EmptyState icon={CircleHelp} title={t('cp37.empty')} action={<Button onClick={() => setParams({ new: 'shipment' })}>{t('cp37.raise')}</Button>} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="tickets">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp37.col.ticket')}</th>
                <th>{t('cp37.col.category')}</th>
                <th>{t('cp37.col.subject')}</th>
                <th>{t('cp37.col.status')}</th>
                <th>{t('cp37.col.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((x) => (
                <tr key={x.id} className="border-b last:border-0" aria-label={x.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ ticket: x.id })}>
                      {x.id}
                    </button>
                  </td>
                  <td>{t(`cp37.cat.${x.category}`, { defaultValue: x.category })}</td>
                  <td>{x.subject}</td>
                  <td>
                    <Chip tone={STATUS_TONE[x.status]}>{t(`cp37.status.${x.status}`)}</Chip>
                  </td>
                  <td className="tabular text-caption">{formatDateTime(lastUpdate(x))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Attach({ value, onChange, id }: { value?: string; onChange: (name?: string) => void; id: string }) {
  const { t } = useTranslation()
  return (
    <label htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 text-caption text-primary hover:underline">
      <Paperclip className="size-4" aria-hidden /> {value ?? t('cp37.attach')}
      <input
        id={id}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && f.size > MAX_MB * 1024 * 1024) {
            toast.error(t('cp37.tooBig', { mb: MAX_MB }))
            e.target.value = ''
            return
          }
          onChange(f?.name)
        }}
      />
    </label>
  )
}

function RaiseTicket({ category, lr, onDone }: { category: TicketCategory; lr: string; onDone: (id?: string) => void }) {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const [f, setF] = useState({ category, ref: lr, subject: '', description: '', attachment: undefined as string | undefined })
  const lrs = Object.values(data.shipments)
    .filter((s) => s.customerId === customer.id)
    .map((s) => s.id)
    .sort()
    .reverse()
  const invoices = Object.values(data.invoices)
    .filter((i) => i.customerId === customer.id)
    .map((i) => i.id)
  const ref = f.ref.trim()
  const isInvoice = invoices.includes(ref)
  const refOk = !ref || isInvoice || lrs.includes(ref)

  const submit = () => {
    const id = useDemoStore.getState().raiseTicket(customer.id, { category: f.category, subject: f.subject, description: f.description, shipmentId: isInvoice ? undefined : ref || undefined, invoiceId: isInvoice ? ref : undefined, attachment: f.attachment }, user.id)
    if (!id) return
    toast.success(t('cp37.raised', { id }))
    onDone(id)
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <button type="button" onClick={() => onDone()} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('cp37.back')}
      </button>
      <PageHeader title={t('cp37.raise')} subtitle={t('cp37.raiseSub')} className="mb-0" />
      <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <Field label={t('cp37.f.category')} htmlFor="t-cat" required>
          <NativeSelect id="t-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TicketCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cp37.cat.${c}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp37.f.ref')} htmlFor="t-ref" error={refOk ? undefined : t('cp37.refUnknown')}>
          <Input id="t-ref" list="t-ref-list" value={f.ref} placeholder="LGS-DEL-000790" onChange={(e) => setF({ ...f, ref: e.target.value.toUpperCase() })} />
          <datalist id="t-ref-list">
            {[...lrs, ...invoices].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label={t('cp37.f.subject')} htmlFor="t-subject" required className="sm:col-span-2">
          <Input id="t-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        </Field>
        <Field label={t('cp37.f.description')} htmlFor="t-desc" required className="sm:col-span-2">
          <textarea id="t-desc" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Attach id="t-file" value={f.attachment} onChange={(attachment) => setF({ ...f, attachment })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button disabled={!f.subject.trim() || !f.description.trim() || !refOk} onClick={submit}>
            {t('cp37.submit')}
          </Button>
          <Button variant="outline" onClick={() => onDone()}>
            {t('common.cancel')}
          </Button>
        </div>
      </section>
    </div>
  )
}

function TicketDetail({ ticket: x, onBack }: { ticket: Ticket; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = useCustomerSession()
  const data = useData((d) => d)
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<string>()
  const who = (id: string) => data.customerUsers[id]?.name ?? (data.staff[id] ? t('cp37.logisco', { name: data.staff[id].name }) : id)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('cp37.back')}
      </button>
      <PageHeader
        title={`${x.id} · ${x.subject}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={STATUS_TONE[x.status]}>{t(`cp37.status.${x.status}`)}</Chip>
            {t(`cp37.cat.${x.category}`, { defaultValue: x.category })}
            {(x.shipmentId || x.invoiceId) && <span className="tabular">· {x.shipmentId ?? x.invoiceId}</span>}
          </span>
        }
        className="mb-0"
      />
      {x.status === 'resolved' && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-success bg-status-success-bg p-4" aria-label={t('cp37.resolvedTitle')}>
          <p>{t('cp37.resolvedBody')}</p>
          <Button onClick={() => (useDemoStore.getState().confirmResolved(x.id, user.id), toast.success(t('cp37.closed', { id: x.id })))}>{t('cp37.confirm')}</Button>
        </section>
      )}
      <ol className="flex flex-col gap-3" data-testid="thread">
        {x.thread.map((m, i) => {
          const mineMsg = !!data.customerUsers[m.by]
          return (
            <li key={i} className={mineMsg ? 'self-end' : 'self-start'}>
              <div className={mineMsg ? 'max-w-xl rounded-xl bg-primary-soft p-3' : 'max-w-xl rounded-xl border bg-card p-3'}>
                <p className="text-caption font-medium">
                  {who(m.by)} · <span className="tabular font-normal text-muted-foreground">{formatDateTime(m.at)}</span>
                </p>
                <p className="whitespace-pre-line">{m.text}</p>
                {m.attachment && (
                  <p className="mt-1 flex items-center gap-1 text-caption text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden /> {m.attachment}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {x.status !== 'closed' && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={t('cp37.reply')}>
          <label htmlFor="t-reply" className="text-caption font-medium">
            {t('cp37.reply')}
          </label>
          <textarea id="t-reply" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Attach id="t-reply-file" value={attachment} onChange={setAttachment} />
            <Button
              disabled={!text.trim()}
              onClick={() => {
                useDemoStore.getState().customerReplyTicket(x.id, text, attachment, user.id)
                setText('')
                setAttachment(undefined)
                toast.success(t('cp37.sent'))
              }}
            >
              {t('cp37.send')}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
