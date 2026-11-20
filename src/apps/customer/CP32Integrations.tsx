/**
 * CP-32 Integrations — docs/01-customer-portal.md. Source §7.2 (API keys,
 * webhooks, ERP connectors), §6 Step 6, §13 (customer ERP connectors: Tally,
 * SAP, Zoho, marketplaces). Admin only. SIMULATED: keys, signing secrets, the
 * webhook test (mock 200 OK) and the connectors. The API documentation page is
 * not built (no basis in the client document).
 */
import { Copy, FileSpreadsheet, KeyRound, Link2, Plug, Plus, RefreshCw, Trash2, Webhook as WebhookIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { WEBHOOK_EVENTS, type ApiKey, type WebhookEvent } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { downloadTemplate } from './settingsFiles'
import { useCustomerSession } from './useCustomerSession'

const ERPS = ['tally', 'sap', 'zoho'] as const

export default function CP32Integrations() {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cp32.title')} subtitle={t('cp32.subtitle')} className="mb-0" />
      <ApiKeys />
      <Webhooks />
      <Connectors />
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp32.templates')}>
        <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
          <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden /> {t('cp32.templates')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {(['booking', 'address', 'sku'] as const).map((k) => (
            <Button key={k} variant="outline" size="sm" onClick={() => downloadTemplate(k)}>
              {t(`cp32.tpl.${k}`)}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-caption text-muted-foreground">{t('cp32.tplNote', { name: customer.shortName })}</p>
      </section>
    </div>
  )
}

function Secret({ title, value, note, onClose }: { title: string; value: string; note: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{note}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
          <code className="tabular min-w-0 flex-1 break-all text-caption" data-testid="secret">
            {value}
          </code>
          <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(value).then(() => toast.success(t('cp32.copied')), () => toast.error(t('cp32.copyFailed')))}>
            <Copy /> {t('cp32.copy')}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t('cp32.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApiKeys() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const c = useData((d) => d.customers[customer.id])
  const [env, setEnv] = useState<ApiKey['env']>('sandbox')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<string>()
  const [revoking, setRevoking] = useState<ApiKey>()
  const keys = (c.integrations.apiKeys ?? []).filter((k) => k.env === env)
  const prodLocked = env === 'production' && c.status !== 'live'

  const create = () => {
    const key = useDemoStore.getState().createApiKey(customer.id, name, env, user.id)
    if (!key) return
    setAdding(false)
    setName('')
    setShown(key)
  }

  return (
    <section className="rounded-xl border bg-card shadow-card" aria-label={t('cp32.keys')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
          <KeyRound className="size-5 text-muted-foreground" aria-hidden /> {t('cp32.keys')} <SimulatedTag />
        </h2>
        <div className="flex gap-2">
          <div role="tablist" aria-label={t('cp32.env')} className="flex rounded-lg border p-0.5">
            {(['sandbox', 'production'] as const).map((e) => (
              <button key={e} type="button" role="tab" aria-selected={env === e} onClick={() => setEnv(e)} className={cn('rounded-md px-3 py-1 text-caption font-medium', env === e && 'bg-primary text-primary-foreground')}>
                {t(`cp32.envs.${e}`)}
              </button>
            ))}
          </div>
          <Button size="sm" disabled={prodLocked} onClick={() => setAdding(true)}>
            <Plus /> {t('cp32.generate')}
          </Button>
        </div>
      </div>
      {prodLocked && <p className="px-5 pt-2 text-caption text-muted-foreground">{t('cp32.prodLocked')}</p>}
      {keys.length === 0 ? (
        <p className="px-5 py-4 text-muted-foreground">{t('cp32.noKeys')}</p>
      ) : (
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="api-keys">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-5 py-2">{t('cp32.col.name')}</th>
              <th>{t('cp32.col.key')}</th>
              <th>{t('cp32.col.created')}</th>
              <th>{t('cp32.col.lastUsed')}</th>
              <th className="sr-only">{t('cp32.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b last:border-0" aria-label={k.name}>
                <td className="px-5 py-2 font-medium">{k.name}</td>
                <td className="tabular">
                  lg_{k.env === 'sandbox' ? 'sbx' : 'live'}_••••{k.last4}
                </td>
                <td className="tabular">{formatDate(k.createdAt)}</td>
                <td className="tabular">{k.lastUsedAt ? formatDate(k.lastUsedAt) : '—'}</td>
                <td className="py-2 text-right">
                  {k.revokedAt ? (
                    <Chip tone="neutral">{t('cp32.revoked', { date: formatDate(k.revokedAt) })}</Chip>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setRevoking(k)}>
                      {t('cp32.revoke')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="h-3" />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('cp32.generateTitle', { env: t(`cp32.envs.${env}`) })}</DialogTitle>
          </DialogHeader>
          <Field label={t('cp32.keyName')} htmlFor="k-name" required>
            <Input id="k-name" value={name} placeholder="Tally connector" onChange={(e) => setName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!name.trim()} onClick={create}>
              {t('cp32.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {shown && <Secret title={t('cp32.keyCreated')} value={shown} note={t('cp32.keyOnce')} onClose={() => setShown(undefined)} />}
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(v) => !v && setRevoking(undefined)}
        title={t('cp32.revokeTitle', { name: revoking?.name ?? '' })}
        body={t('cp32.revokeBody')}
        confirmLabel={t('cp32.revoke')}
        destructive
        onConfirm={() => {
          if (revoking) {
            useDemoStore.getState().revokeApiKey(customer.id, revoking.id, user.id)
            toast.success(t('cp32.revokedToast', { name: revoking.name }))
          }
          setRevoking(undefined)
        }}
      />
    </section>
  )
}

function Webhooks() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const c = useData((d) => d.customers[customer.id])
  const hooks = c.integrations.webhooks ?? []
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('https://')
  const [events, setEvents] = useState<WebhookEvent[]>([...WEBHOOK_EVENTS])
  const [shown, setShown] = useState<string>()
  const httpsOk = /^https:\/\/[^\s/]+\.[^\s]+$/.test(url.trim())
  const store = useDemoStore.getState

  const add = () => {
    const secret = store().addWebhook(customer.id, url, events, user.id)
    if (!secret) return
    setAdding(false)
    setUrl('https://')
    setShown(secret)
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp32.webhooks')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
          <WebhookIcon className="size-5 text-muted-foreground" aria-hidden /> {t('cp32.webhooks')}
        </h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> {t('cp32.addWebhook')}
        </Button>
      </div>
      {hooks.length === 0 ? (
        <p className="text-muted-foreground">{t('cp32.noWebhooks')}</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="webhooks">
          {hooks.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 rounded-lg border p-3" aria-label={w.url}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-caption break-all">{w.url}</code>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = store().testWebhook(customer.id, w.id)
                      if (r.status === 200) toast.success(t('cp32.testOk', { ms: r.ms }))
                      else toast.error(t('cp32.testFail'))
                    }}
                  >
                    {t('cp32.test')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShown(store().regenerateSecret(customer.id, w.id, user.id))}>
                    <RefreshCw /> {t('cp32.regenerate')}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={t('cp32.removeWebhook')} onClick={() => (store().removeWebhook(customer.id, w.id, user.id), toast.success(t('cp32.removed')))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="text-caption text-muted-foreground">
                {w.events.length === WEBHOOK_EVENTS.length ? t('cp32.allEvents') : w.events.map((e) => t(`cp32.ev.${e}`)).join(', ')} · {t('cp32.secret', { last4: w.secretLast4 })}
                {w.lastTest && ` · ${t('cp32.lastTest', { status: w.lastTest.status, at: formatDateTime(w.lastTest.at) })}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('cp32.addWebhook')}</DialogTitle>
          </DialogHeader>
          <Field label={t('cp32.endpoint')} htmlFor="w-url" required error={url.length > 8 && !httpsOk ? t('cp32.httpsOnly') : undefined}>
            <Input id="w-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1 text-caption font-medium">{t('cp32.events')}</legend>
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-caption">
                <Checkbox checked={events.includes(e)} onCheckedChange={(v) => setEvents(v ? [...events, e] : events.filter((x) => x !== e))} /> {t(`cp32.ev.${e}`)}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!httpsOk || !events.length} onClick={add}>
              {t('cp32.addWebhook')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {shown && <Secret title={t('cp32.secretTitle')} value={shown} note={t('cp32.secretOnce')} onClose={() => setShown(undefined)} />}
    </section>
  )
}

function Connectors() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const c = useData((d) => d.customers[customer.id])
  const [seller, setSeller] = useState('')
  const store = useDemoStore.getState
  const i = c.integrations

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp32.connectors')}>
      <h2 className="mb-3 flex items-center gap-2 font-heading text-section font-semibold">
        <Plug className="size-5 text-muted-foreground" aria-hidden /> {t('cp32.connectors')} <SimulatedTag />
      </h2>
      <div className="grid gap-3 md:grid-cols-4">
        {ERPS.map((erp) => {
          const on = i.erp === erp
          return (
            <div key={erp} className="flex flex-col gap-2 rounded-lg border p-3" aria-label={t(`cp32.erp.${erp}`)}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t(`cp32.erp.${erp}`)}</span>
                <Chip tone={on ? 'success' : 'neutral'}>{t(on ? 'cp32.connected' : 'cp32.notConnected')}</Chip>
              </div>
              {on && i.erpSync && <p className="text-caption text-muted-foreground">{t('cp32.sync', { every: i.erpSync.everyMinutes, at: formatDateTime(i.erpSync.lastAt) })}</p>}
              <Button
                size="sm"
                variant={on ? 'outline' : 'default'}
                disabled={!on && !!i.erp}
                onClick={() => (store().setErpConnector(customer.id, on ? undefined : erp, user.id), toast.success(t(on ? 'cp32.disconnected' : 'cp32.connectedToast', { erp: t(`cp32.erp.${erp}`) })))}
              >
                {t(on ? 'cp32.disconnect' : 'cp32.connect')}
              </Button>
              {!on && i.erp && <p className="text-caption text-muted-foreground">{t('cp32.oneErp')}</p>}
            </div>
          )
        })}
        <div className="flex flex-col gap-2 rounded-lg border p-3" aria-label={t('cp32.ondc')}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold">
              <Link2 className="size-4" aria-hidden /> {t('cp32.ondc')}
            </span>
            <Chip tone={i.ondcSellerId ? 'success' : 'neutral'}>{t(i.ondcSellerId ? 'cp32.connected' : 'cp32.notConnected')}</Chip>
          </div>
          {i.ondcSellerId ? (
            <>
              <p className="tabular text-caption">{t('cp32.sellerIs', { id: i.ondcSellerId })}</p>
              <Button size="sm" variant="outline" onClick={() => (store().setOndcLink(customer.id, undefined, user.id), toast.success(t('cp32.ondcOff')))}>
                {t('cp32.disconnect')}
              </Button>
            </>
          ) : (
            <>
              <Input aria-label={t('cp32.sellerId')} placeholder={t('cp32.sellerId')} value={seller} onChange={(e) => setSeller(e.target.value)} />
              <Button size="sm" disabled={!seller.trim()} onClick={() => (store().setOndcLink(customer.id, seller, user.id), setSeller(''), toast.success(t('cp32.ondcOn')))}>
                {t('cp32.connect')}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
