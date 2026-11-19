/**
 * ERP-22 Customer rate cards — docs/04-erp-control-tower.md §6.6.
 * Standard and negotiated cards: parcel by zone and tier, PTL per lane,
 * surcharges. Every line is checked by the AI margin engine against today's
 * partner costs and the target margin before activation (source §6 Step 5,
 * §8.1); lines below target go to the Pricing Head (ERP-23).
 */
import { ArrowLeft, Copy, Plus, Send, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cardMargins, linesBelowTarget, type LineMargin } from '@shared/engines/rateCardMargin'
import { useData } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { RateEdit } from '@shared/store/contractActions'
import type { CustomerRateCard, ParcelTier, ParcelZone } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { useErpSession } from './useErpSession'

const STATUS_TONE = { draft: 'neutral', pendingApproval: 'warning', live: 'success', expired: 'neutral' } as const
const ZONES: ParcelZone[] = ['A', 'B', 'C', 'D', 'E']
const TIERS: ParcelTier[] = ['economy', 'standard', 'express']
const SURCHARGES = ['fuelPct', 'odaPerKg', 'odaMin', 'docketPtl', 'docketParcel', 'appointment', 'codPct', 'codMin', 'toPayFee', 'fovPct', 'specialHandlingPerPiece', 'liabilityPerKg', 'liabilityMax'] as const

export default function ERP22RateCards() {
  const { cardId } = useParams()
  return cardId ? <CardDetail cardId={cardId} /> : <CardList />
}

function CardList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [open, setOpen] = useState(false)
  const cards = Object.values(data.rateCards).sort((a, b) => (a.type === 'standard' ? -1 : b.type === 'standard' ? 1 : a.name.localeCompare(b.name)))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp22.title')}
        subtitle={t('erp22.subtitle')}
        className="mb-0"
        actions={
          <Button disabled={user.role !== 'pricing'} onClick={() => setOpen(true)}>
            <Plus /> {t('erp22.new')}
          </Button>
        }
      />
      <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-card">
        {cards.map((c) => (
          <li key={c.id}>
            <Link to={`/erp/pricing/rate-cards/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-accent">
              <span>
                <span className="font-semibold">{c.name}</span>
                <span className="block text-caption text-muted-foreground">
                  {t(`erp22.type.${c.type}`)}
                  {c.customerId ? ` · ${data.customers[c.customerId]?.shortName}` : ''} · {formatDate(c.validFrom)} – {formatDate(c.validTo)}
                </span>
              </span>
              <Chip tone={STATUS_TONE[c.status]}>{t(`erp22.status.${c.status}`)}</Chip>
            </Link>
          </li>
        ))}
      </ul>
      <NewCardDialog open={open} onOpenChange={setOpen} onCreated={(id) => navigate(`/erp/pricing/rate-cards/${id}`)} />
    </div>
  )
}

function NewCardDialog({ open, onOpenChange, onCreated, fromId = 'RC-STANDARD' }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void; fromId?: string }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const customers = Object.values(data.customers).sort((a, b) => a.shortName.localeCompare(b.shortName))
  const [customerId, setCustomerId] = useState(customers.find((c) => c.onboarding && c.status === 'contract')?.id ?? customers[0]?.id)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('erp22.new')}</DialogTitle>
        </DialogHeader>
        <Field label={t('erp22.customer')} htmlFor="nc-cust">
          <NativeSelect id="nc-cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName}
                {c.onboarding && c.status !== 'live' ? ` · ${t(`customerStatus.${c.status}`)}` : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <p className="text-caption text-muted-foreground">{t('erp22.cloneFrom', { name: data.rateCards[fromId]?.name })}</p>
        <Button
          onClick={() => {
            const id = useDemoStore.getState().createNegotiatedCard(customerId, fromId, user.id)
            onOpenChange(false)
            toast.success(t('erp22.created'))
            onCreated(id)
          }}
        >
          {t('erp22.create')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function MarginChip({ m }: { m?: LineMargin }) {
  const { t } = useTranslation()
  if (!m) return <span className="text-caption text-muted-foreground">—</span>
  return (
    <Chip tone={m.belowTarget ? 'danger' : 'success'} className="tabular">
      {m.belowTarget ? t('erp22.below') : t('erp22.ok')} {m.marginPct.toFixed(1)}%
    </Chip>
  )
}

function CardDetail({ cardId }: { cardId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const card: CustomerRateCard | undefined = data.rateCards[cardId]
  const margins = useMemo(() => (card ? cardMargins(data, card) : undefined), [data, card])
  const [cloneOpen, setCloneOpen] = useState(false)
  if (!card || !margins) return <NotFound />
  const editable = card.status === 'draft' && user.role === 'pricing'
  const below = linesBelowTarget(margins)
  const edit = (e: RateEdit) => useDemoStore.getState().editRateCard(card.id, e)
  const num = (value: number, onChange: (v: number) => void, label: string) =>
    editable ? <Input type="number" min={0} step={0.5} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="tabular h-8 w-20" /> : <span className="tabular">{value}</span>

  return (
    <div className="flex flex-col gap-4">
      <Link to="/erp/pricing/rate-cards" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('erp22.title')}
      </Link>
      <PageHeader
        title={card.name}
        subtitle={`${t(`erp22.type.${card.type}`)}${card.customerId ? ` · ${data.customers[card.customerId]?.shortName}` : ''} · ${formatDate(card.validFrom)} – ${formatDate(card.validTo)}`}
        className="mb-0"
        actions={
          <div className="flex gap-2">
            <Chip tone={STATUS_TONE[card.status]}>{t(`erp22.status.${card.status}`)}</Chip>
            <Button variant="outline" size="sm" disabled={user.role !== 'pricing'} onClick={() => setCloneOpen(true)}>
              <Copy /> {t('erp22.clone')}
            </Button>
            {card.status === 'draft' && (
              <Button size="sm" disabled={!editable} onClick={() => (useDemoStore.getState().submitRateCard(card.id, user.id), toast.success(below.length ? t('erp22.sentForApproval', { count: below.length }) : t('erp22.activated')))}>
                <Send /> {t('erp22.submit')}
              </Button>
            )}
          </div>
        }
      />

      <section className={below.length ? 'rounded-xl border-2 border-status-warning bg-status-warning-bg p-4' : 'rounded-xl border-2 border-status-success bg-status-success-bg p-4'} data-testid="margin-summary">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4" aria-hidden /> {below.length ? t('erp22.summaryBelow', { count: below.length, target: data.settings.targetMarginPct }) : t('erp22.summaryOk', { target: data.settings.targetMarginPct })} <SimulatedTag />
        </p>
        <p className="text-caption">{t('erp22.method')}</p>
        {card.approval?.comment && (
          <p className="mt-1 text-caption">
            {t(`erp22.decision.${card.approval.decision}`)} · {data.staff[card.approval.decidedBy ?? '']?.name}: {card.approval.comment}
          </p>
        )}
      </section>

      <Tabs defaultValue="ptl">
        <TabsList>
          <TabsTrigger value="ptl">{t('cp08.tab.ptl')}</TabsTrigger>
          <TabsTrigger value="parcel">{t('cp08.tab.parcel')}</TabsTrigger>
          <TabsTrigger value="surcharges">{t('cp08.tab.surcharges')}</TabsTrigger>
        </TabsList>
        <TabsContent value="ptl">
          <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-card">
            <table className="w-full text-table" data-testid="ptl-lines">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="py-2">{t('cp08.lane')}</th>
                  <th>{t('cp08.service')}</th>
                  <th>{t('cp08.perKg')}</th>
                  <th>{t('cp08.minKg')}</th>
                  <th>{t('cp08.cft')}</th>
                  <th>{t('erp22.margin')}</th>
                </tr>
              </thead>
              <tbody>
                {card.ptl.map((l, i) => {
                  const lane = data.lanes[l.laneId]
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">
                        {lane.originRegion} → {lane.destRegion}
                      </td>
                      <td>{t(`service.${l.service}`)}</td>
                      <td>{num(l.perKg, (v) => edit({ kind: 'ptl', index: i, field: 'perKg', value: v }), `${lane.originRegion} → ${lane.destRegion} ${l.service} ${t('cp08.perKg')}`)}</td>
                      <td>{num(l.minKg, (v) => edit({ kind: 'ptl', index: i, field: 'minKg', value: v }), `${t('cp08.minKg')} ${i}`)}</td>
                      <td>{num(l.cftFactor, (v) => edit({ kind: 'ptl', index: i, field: 'cftFactor', value: v }), `${t('cp08.cft')} ${i}`)}</td>
                      <td>
                        <MarginChip m={margins.ptl[i]?.m} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="parcel">
          <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-card">
            <table className="w-full text-table">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="py-2">{t('cp08.zone')}</th>
                  {TIERS.map((tier) => (
                    <th key={tier}>{t(`service.${tier}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ZONES.filter((z) => card.parcel[z]).map((z) => (
                  <tr key={z} className="border-b align-top last:border-0">
                    <td className="py-2">
                      <span className="font-semibold">{z}</span> {t(`cp08.zoneName.${z}`)}
                    </td>
                    {TIERS.map((tier) => (
                      <td key={tier} className="py-2">
                        <div className="flex items-center gap-1">
                          {num(card.parcel[z][tier].first, (v) => edit({ kind: 'parcel', zone: z, tier, field: 'first', value: v }), `${z} ${tier} ${t('erp22.first')}`)}+
                          {num(card.parcel[z][tier].additional, (v) => edit({ kind: 'parcel', zone: z, tier, field: 'additional', value: v }), `${z} ${tier} ${t('erp22.additional')}`)}
                        </div>
                        <div className="mt-1">
                          <MarginChip m={margins.parcel.find((p) => p.zone === z && p.tier === tier)?.m} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="surcharges">
          <dl className="grid gap-x-8 gap-y-2 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-2">
            {SURCHARGES.map((k) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b py-1">
                <dt>{t(`erp22.s.${k}`)}</dt>
                <dd>{num(card.surcharges[k], (v) => edit({ kind: 'surcharge', field: k, value: v }), t(`erp22.s.${k}`))}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
      </Tabs>
      <NewCardDialog open={cloneOpen} onOpenChange={setCloneOpen} fromId={card.id} onCreated={(id) => navigate(`/erp/pricing/rate-cards/${id}`)} />
    </div>
  )
}
