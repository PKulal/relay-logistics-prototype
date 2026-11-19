/**
 * CP-09 Integration setup — docs/01-customer-portal.md §6.1.
 * Source §6 Step 6: API keys, ERP connector (Tally / SAP / Zoho), Excel
 * template, marketplace or ONDC link; SKU master uploaded with dimensions →
 * weight freeze; AI flags dimension outliers. SIMULATED: connectors, API key,
 * ONDC link and the outlier check.
 */
import { ArrowRight, CheckCircle2, Download, KeyRound, Link2, Loader2, Plug, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useData } from '@shared/hooks/useDemo'
import { formatKg } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { skuOutlier, type SkuRow } from '@shared/store/contractActions'
import type { Sku } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

const SKU_COLUMNS = ['code', 'description', 'l', 'b', 'h', 'weight', 'hsn', 'unitValue'] as const

/** Sample SKU master for the demo: one line has an implausible weight (an outlier). */
const SAMPLE_SKUS: SkuRow[] = [
  { code: 'CW-1.5', description: 'Copper wire 1.5 sq mm, 90 m coil', l: 28, b: 28, h: 10, weight: 6.2, hsn: '8544', unitValue: 1650 },
  { code: 'CW-2.5', description: 'Copper wire 2.5 sq mm, 90 m coil', l: 30, b: 30, h: 12, weight: 9.5, hsn: '8544', unitValue: 2400 },
  { code: 'CW-4.0', description: 'Copper wire 4 sq mm, 90 m coil', l: 32, b: 32, h: 14, weight: 14.8, hsn: '8544', unitValue: 3700 },
  { code: 'AC-10', description: 'Armoured cable 10 sq mm, 50 m', l: 55, b: 55, h: 25, weight: 38, hsn: '8544', unitValue: 9800 },
  { code: 'FL-6', description: 'Flexible cable 6 sq mm, 100 m', l: 40, b: 40, h: 18, weight: 21, hsn: '8544', unitValue: 5200 },
  { code: 'CD-500', description: 'Cable drum 500 m (empty weight entered wrongly)', l: 60, b: 60, h: 60, weight: 900, hsn: '8544', unitValue: 48000 },
]

export default function CP09Integration() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer: c } = useCustomerSession()
  const data = useData((d) => d)
  const store = useDemoStore.getState
  const i = c.integrations
  const [erp, setErp] = useState<'tally' | 'sap' | 'zoho'>(i.erp ?? 'tally')
  const [connecting, setConnecting] = useState(false)
  const [ondc, setOndc] = useState(i.ondcSellerId ?? '')
  const file = useRef<HTMLInputElement>(null)
  const skus = Object.values(data.skus).filter((s) => s.customerId === c.id)
  const done = c.status !== 'integration'

  const connect = async () => {
    setConnecting(true)
    await new Promise((r) => setTimeout(r, 2000))
    store().setIntegration(c.id, { kind: 'erp', erp })
    setConnecting(false)
    toast.success(t('cp09.connected', { erp: t(`cp09.erpName.${erp}`) }))
  }
  const template = () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ consigneeName: 'Hubli Electric Distributors', consigneePincode: '580030', pieces: 6, l: 60, b: 40, h: 40, weightKg: 20, invoiceNo: 'INV-001', invoiceValue: 180000, service: 'expressPtl' }]), 'Bookings')
    XLSX.writeFile(book, 'logisco_booking_template.xlsx')
    store().setIntegration(c.id, { kind: 'template' })
  }
  const skuTemplate = () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(SAMPLE_SKUS.slice(0, 1), { header: [...SKU_COLUMNS] }), 'SKUs')
    XLSX.writeFile(book, 'sku_master_template.xlsx')
  }
  const upload = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer())
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    const parsed: SkuRow[] = rows.map((r) => ({ code: String(r.code ?? ''), description: String(r.description ?? ''), l: Number(r.l), b: Number(r.b), h: Number(r.h), weight: Number(r.weight), hsn: String(r.hsn ?? ''), unitValue: Number(r.unitValue) || 0 }))
    const valid = parsed.filter((r) => r.code && r.l > 0 && r.b > 0 && r.h > 0 && r.weight > 0)
    if (!valid.length) return toast.error(t('cp09.badFile'))
    store().uploadSkus(c.id, valid, user.id)
    toast.success(t('cp09.uploaded', { count: valid.length }))
  }

  return (
    <div className="max-w-4xl">
      <OnboardingSteps customer={c} current="integration" />
      <PageHeader title={t('cp09.title')} subtitle={t('cp09.subtitle')} />

      <ul className="flex flex-col gap-3">
        <Item title={t('cp09.portal')} ok>
          <p className="text-caption text-muted-foreground">{t('cp09.portalBody')}</p>
        </Item>
        <Item title={t('cp09.excel')} ok={!!i.templateDownloaded}>
          <Button variant="outline" size="sm" onClick={template}>
            <Download /> {t('cp09.downloadTemplate')}
          </Button>
        </Item>
        <Item title={t('cp09.api')} ok={!!i.apiKey}>
          {i.apiKey ? (
            <p className="tabular flex flex-wrap items-center gap-2 text-caption">
              <KeyRound className="size-4" aria-hidden /> <code className="rounded bg-gray-50 px-2 py-0.5" data-testid="api-key">{i.apiKey}</code> <SimulatedTag />
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => store().setIntegration(c.id, { kind: 'apiKey' })}>
              <KeyRound /> {t('cp09.generateKey')}
            </Button>
          )}
        </Item>
        <Item title={t('cp09.erp')} ok={!!i.erp}>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect aria-label={t('cp09.erp')} value={erp} onChange={(e) => setErp(e.target.value as 'tally' | 'sap' | 'zoho')} className="w-40">
              {(['tally', 'sap', 'zoho'] as const).map((e) => (
                <option key={e} value={e}>
                  {t(`cp09.erpName.${e}`)}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" size="sm" disabled={connecting} onClick={connect}>
              {connecting ? <Loader2 className="animate-spin" /> : <Plug />} {i.erp ? t('cp09.reconnect') : t('cp09.connect')}
            </Button>
            {i.erp && <Chip tone="success">{t('cp09.connectedChip', { erp: t(`cp09.erpName.${i.erp}`) })}</Chip>}
            <SimulatedTag />
          </div>
        </Item>
        <Item title={t('cp09.ondc')} ok={!!i.ondcSellerId}>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label={t('cp09.sellerId')} placeholder={t('cp09.sellerId')} value={ondc} onChange={(e) => setOndc(e.target.value)} className="w-56" />
            <Button variant="outline" size="sm" disabled={!ondc.trim()} onClick={() => (store().setIntegration(c.id, { kind: 'ondc', sellerId: ondc }), toast.success(t('cp09.linked')))}>
              <Link2 /> {t('cp09.link')}
            </Button>
          </div>
        </Item>
        <Item title={t('cp09.skus')} ok={skus.length > 0 && skus.every((s) => s.status === 'frozen')}>
          <p className="mb-2 text-caption text-muted-foreground">{t('cp09.skusBody')}</p>
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
              <Upload /> {t('cp09.upload')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => (store().uploadSkus(c.id, SAMPLE_SKUS, user.id), toast.success(t('cp09.uploaded', { count: SAMPLE_SKUS.length })))}>
              {t('cp09.sample')}
            </Button>
            <Button variant="ghost" size="sm" onClick={skuTemplate}>
              <Download /> {t('cp09.skuTemplate')}
            </Button>
          </div>
          {skus.length > 0 && <SkuTable skus={skus} />}
        </Item>
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        {done ? (
          <Button onClick={() => navigate('/customer/onboarding')}>
            {t('cp09.toTracker')} <ArrowRight />
          </Button>
        ) : (
          <>
            <Button onClick={() => (store().completeIntegration(c.id, false, user.id), toast.success(t('cp09.pilotStarts')), navigate('/customer/onboarding'))}>{t('cp09.complete')}</Button>
            <Button variant="outline" onClick={() => (store().completeIntegration(c.id, true, user.id), navigate('/customer/onboarding'))}>
              {t('cp09.skip')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Item({ title, ok, children }: { title: string; ok: boolean; children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {ok ? (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-status-success">
            <CheckCircle2 className="size-4" aria-hidden /> {t('cp09.ready')}
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">{t('cp09.optional')}</span>
        )}
      </div>
      {children}
    </li>
  )
}

function SkuTable({ skus }: { skus: Sku[] }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-table" data-testid="sku-table">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="py-2">{t('cp09.code')}</th>
            <th>{t('cp09.dims')}</th>
            <th>{t('cp09.weight')}</th>
            <th>{t('cp09.status')}</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((s) => (
            <SkuRowView key={s.id} s={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkuRowView({ s }: { s: Sku }) {
  const { t } = useTranslation()
  const [d, setD] = useState({ l: s.l, b: s.b, h: s.h, weight: s.weight })
  const why = skuOutlier(s)
  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-2">
        <span className="tabular font-medium">{s.code}</span>
        <span className="block text-caption text-muted-foreground">{s.description}</span>
      </td>
      <td className="tabular">
        {s.status === 'flagged' ? (
          <span className="flex gap-1">
            {(['l', 'b', 'h'] as const).map((k) => (
              <Input key={k} aria-label={`${s.code} ${k.toUpperCase()}`} type="number" min={1} value={d[k]} onChange={(e) => setD({ ...d, [k]: Number(e.target.value) })} className="h-8 w-16" />
            ))}
          </span>
        ) : (
          `${s.l} × ${s.b} × ${s.h} cm`
        )}
      </td>
      <td className="tabular">
        {s.status === 'flagged' ? <Input aria-label={`${s.code} ${t('cp09.weight')}`} type="number" min={0.1} step={0.1} value={d.weight} onChange={(e) => setD({ ...d, weight: Number(e.target.value) })} className="h-8 w-20" /> : formatKg(s.weight)}
      </td>
      <td>
        {s.status === 'frozen' ? (
          <Chip tone="success">{t('cp09.frozen')}</Chip>
        ) : (
          <span className="flex flex-col items-start gap-1">
            <Chip tone="warning">
              <TriangleAlert className="size-3" aria-hidden /> {t(`cp09.outlier.${why ?? 'density'}`)}
            </Chip>
            <Button size="sm" variant="outline" onClick={() => useDemoStore.getState().fixSku(s.id, d)}>
              {t('cp09.recheck')}
            </Button>
          </span>
        )}
      </td>
    </tr>
  )
}
