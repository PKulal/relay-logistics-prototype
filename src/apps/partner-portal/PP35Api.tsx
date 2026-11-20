/**
 * PP-35 API and integration — docs/02-partner-portal.md. Source §13 (Partner
 * API, webhook: job push and status updates), §4 Step 6. For Types A and E.
 * SIMULATED: keys, the signing secret and the test event (mock 200 OK).
 */
import { KeyRound, Plus, Trash2, Webhook } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { STATUS_ENDPOINT } from '@shared/engines/partnerSettings'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { JOB_PUSH_EVENTS, type JobPushEvent, type PartnerIntegration } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

const STATUSES: PartnerIntegration['statusMapping'][number]['status'][] = ['accepted', 'pickedUp', 'inTransit', 'arrived', 'delivered', 'failed']
const card = 'rounded-xl border bg-card p-5 shadow-card'

export default function PP35Api() {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const p = useData((d) => d.partners[partner.id])
  const i = p.integration ?? { apiKeys: [], statusMapping: [], errors: [] }
  const store = useDemoStore.getState
  const [keyName, setKeyName] = useState('')
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox')
  const [shown, setShown] = useState<string>()
  const [url, setUrl] = useState(i.webhook?.url ?? 'https://')
  const [events, setEvents] = useState<JobPushEvent[]>(i.webhook?.events ?? [...JOB_PUSH_EVENTS])
  const [mapping, setMapping] = useState(i.statusMapping)
  const httpsOk = /^https:\/\/[^\s/]+\.[^\s]+$/.test(url.trim())
  const dupes = new Set(mapping.map((m) => m.code.trim().toUpperCase())).size !== mapping.length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp35.title')} subtitle={t('pp35.subtitle')} className="mb-0" />

      <section className={card} aria-label={t('cp32.keys')}>
        <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
          <KeyRound className="size-5 text-muted-foreground" aria-hidden /> {t('cp32.keys')} <SimulatedTag />
        </h2>
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-keys">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('cp32.col.name')}</th>
              <th>{t('cp32.env')}</th>
              <th>{t('cp32.col.key')}</th>
              <th>{t('cp32.col.lastUsed')}</th>
              <th className="sr-only">{t('cp32.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {i.apiKeys.map((k) => (
              <tr key={k.id} className="border-b last:border-0" aria-label={k.name}>
                <td className="py-2 font-medium">{k.name}</td>
                <td>{t(`cp32.envs.${k.env}`)}</td>
                <td className="tabular">
                  lg_p_{k.env === 'sandbox' ? 'sbx' : 'live'}_••••{k.last4}
                </td>
                <td className="tabular">{k.lastUsedAt ? formatDate(k.lastUsedAt) : '—'}</td>
                <td className="text-right">
                  {k.revokedAt ? (
                    <Chip tone="neutral">{t('cp32.revoked', { date: formatDate(k.revokedAt) })}</Chip>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => (store().revokePartnerApiKey(p.id, k.id, user.id), toast.success(t('cp32.revokedToast', { name: k.name })))}>
                      {t('cp32.revoke')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label={t('cp32.keyName')} htmlFor="pk-name" small>
            <Input id="pk-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          </Field>
          <Field label={t('cp32.env')} htmlFor="pk-env" small>
            <NativeSelect id="pk-env" value={env} onChange={(e) => setEnv(e.target.value as typeof env)}>
              <option value="sandbox">{t('cp32.envs.sandbox')}</option>
              <option value="production">{t('cp32.envs.production')}</option>
            </NativeSelect>
          </Field>
          <Button
            disabled={!keyName.trim()}
            onClick={() => {
              const key = store().createPartnerApiKey(p.id, keyName, env, user.id)
              if (key) {
                setShown(key)
                setKeyName('')
              } else toast.error(t('cp32.prodLocked'))
            }}
          >
            <Plus /> {t('cp32.generate')}
          </Button>
        </div>
      </section>

      <section className={card} aria-label={t('pp35.webhook')}>
        <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
          <Webhook className="size-5 text-muted-foreground" aria-hidden /> {t('pp35.webhook')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={t('cp32.endpoint')} htmlFor="pw-url" required error={url.length > 8 && !httpsOk ? t('cp32.httpsOnly') : undefined}>
            <Input id="pw-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <fieldset className="flex flex-wrap items-center gap-3 self-end pb-2">
            <legend className="sr-only">{t('cp32.events')}</legend>
            {JOB_PUSH_EVENTS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-caption">
                <Checkbox checked={events.includes(e)} onCheckedChange={(v) => setEvents(v ? [...events, e] : events.filter((x) => x !== e))} /> {t(`pp35.ev.${e}`)}
              </label>
            ))}
          </fieldset>
        </div>
        {i.webhook && (
          <p className="text-caption text-muted-foreground">
            {t('cp32.secret', { last4: i.webhook.secretLast4 })}
            {i.webhook.lastTest && ` · ${t('cp32.lastTest', { status: i.webhook.lastTest.status, at: formatDateTime(i.webhook.lastTest.at) })}`}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            disabled={!httpsOk || !events.length}
            onClick={() => {
              const r = store().setJobWebhook(p.id, url, events, user.id)
              if (r.secret) setShown(r.secret)
              else if (r.saved) toast.success(t('pp35.saved'))
            }}
          >
            {t('common.save')}
          </Button>
          <Button
            variant="outline"
            disabled={!i.webhook}
            onClick={() => {
              const r = store().testJobWebhook(p.id)
              if (r.status === 200) toast.success(t('cp32.testOk', { ms: r.ms }))
              else toast.error(t('cp32.testFail'))
            }}
          >
            {t('cp32.test')}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-label={t('pp35.mapping')}>
          <h2 className="mb-1 font-heading text-section font-semibold">{t('pp35.mapping')}</h2>
          <p className="mb-2 text-caption text-muted-foreground">
            {t('pp35.endpoint')} <code className="tabular">{STATUS_ENDPOINT}</code>
          </p>
          <ul className="flex flex-col gap-2" data-testid="mapping">
            {mapping.map((m, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <Input aria-label={t('pp35.code')} className="w-28" value={m.code} onChange={(e) => setMapping(mapping.map((x, j) => (j === idx ? { ...x, code: e.target.value.toUpperCase() } : x)))} />
                <span aria-hidden>→</span>
                <NativeSelect aria-label={t('pp35.status')} value={m.status} onChange={(e) => setMapping(mapping.map((x, j) => (j === idx ? { ...x, status: e.target.value as typeof m.status } : x)))}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`pp35.st.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
                <Button size="sm" variant="ghost" aria-label={t('pp35.removeRow')} onClick={() => setMapping(mapping.filter((_, j) => j !== idx))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          {dupes && <p className="mt-2 text-caption text-status-danger">{t('pp35.dupes')}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMapping([...mapping, { code: '', status: 'inTransit' }])}>
              <Plus /> {t('pp35.addRow')}
            </Button>
            <Button size="sm" disabled={dupes} onClick={() => (store().saveStatusMapping(p.id, mapping, user.id), toast.success(t('pp35.mappingSaved')))}>
              {t('common.save')}
            </Button>
          </div>
        </section>

        <section className={card} aria-label={t('pp35.errors')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('pp35.errors')}</h2>
          {i.errors.length === 0 ? (
            <p className="text-muted-foreground">{t('pp35.noErrors')}</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="errors">
              {i.errors.map((e, idx) => (
                <li key={idx} className="text-caption">
                  <span className="tabular text-muted-foreground">{formatDateTime(e.at)}</span> · <code>{e.call}</code>
                  <span className="block text-status-danger">{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {shown && (
        <Dialog open onOpenChange={(o) => !o && setShown(undefined)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('cp32.keyCreated')}</DialogTitle>
              <DialogDescription>{t('cp32.keyOnce')}</DialogDescription>
            </DialogHeader>
            <code className="tabular block rounded-md border bg-muted p-2 text-caption break-all" data-testid="secret">
              {shown}
            </code>
            <DialogFooter>
              <Button onClick={() => setShown(undefined)}>{t('cp32.done')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
