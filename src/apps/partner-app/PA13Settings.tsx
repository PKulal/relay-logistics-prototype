/**
 * PA-13 Settings and sync queue — docs/03-partner-app.md. Source §5.1 (works
 * offline, syncs when connected; Hindi voice prompts). The offline network is
 * the demo toolbar's "Offline" switch (SIMULATED). Log out is blocked while
 * items are waiting to be sent.
 */
import { LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { APP_VERSION, queueOf, storageMb } from '@shared/engines/fieldDay'
import { useData, useDemoNow, useFlags } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import type { FieldStaff } from '@shared/types'
import { Button } from '@shared/ui/button'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { useFieldSession } from './useFieldSession'

export default function PA13Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const { offline } = useFlags()
  const setLanguage = useSession((s) => s.setLanguage)
  const logout = useSession((s) => s.logout)
  const [sending, setSending] = useState(false)
  const queue = queueOf(data, staff.id)

  const sync = () => {
    setSending(true)
    setTimeout(() => {
      useDemoStore.getState().syncNow(staff.id)
      setSending(false)
      if (offline) toast.error(t('pa13.failed'))
      else toast.success(t('pa13.sent', { count: queue.length }))
    }, 600)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa13.title')}</h1>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-label={t('pa13.language')}>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('pa13.language')}</span>
          <NativeSelect
            value={staff.language}
            className="h-12"
            onChange={(e) => {
              const lang = e.target.value as FieldStaff['language']
              useDemoStore.getState().setFieldLanguage(staff.id, lang)
              if (lang !== 'kn') setLanguage(lang)
            }}
          >
            <option value="hi">हिन्दी</option>
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </NativeSelect>
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block font-bold">{t('pa13.voice')}</span>
            <span className="block text-caption text-muted-foreground">{t('pa13.voiceHint')}</span>
          </span>
          <Switch checked={staff.voicePrompts ?? true} aria-label={t('pa13.voice')} onCheckedChange={(v) => useDemoStore.getState().setVoicePrompts(staff.id, v)} />
        </label>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4" aria-label={t('pa13.queue')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">{t('pa13.queue')}</h2>
          <Chip tone={offline ? 'warning' : 'success'}>{t(offline ? 'pa.offline' : 'pa13.online')}</Chip>
        </div>
        {queue.length === 0 ? (
          <p className="text-muted-foreground">{t('pa13.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y" data-testid="sync-queue">
            {queue.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{t(`pa13.ev.${q.type}`, { defaultValue: q.type })}</span>
                  <span className="tabular block text-caption text-muted-foreground">
                    {q.shipmentId} · {t('pa13.photos', { count: q.photos })} · {formatDateTime(q.savedAt)}
                  </span>
                </span>
                <Chip tone={sending ? 'info' : q.status === 'failed' ? 'danger' : 'warning'}>{t(`pa13.st.${sending ? 'sending' : q.status}`)}</Chip>
              </li>
            ))}
          </ul>
        )}
        <Button size="lg" variant="outline" disabled={!queue.length || sending} onClick={sync}>
          <RefreshCw className={sending ? 'animate-spin' : undefined} /> {t('pa13.syncNow')}
        </Button>
      </section>

      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4 text-caption" aria-label={t('pa13.device')}>
        <p>{t('pa13.storage', { mb: storageMb(data, staff.id, now) })}</p>
        <p className="text-muted-foreground">{t('pa13.storageNote')}</p>
        <p>{t('pa13.version', { version: APP_VERSION })}</p>
      </section>

      <Button
        size="lg"
        variant="outline"
        disabled={queue.length > 0}
        onClick={() => {
          logout('partnerApp')
          navigate('/app/login')
        }}
      >
        <LogOut /> {t('header.logout')}
      </Button>
      {queue.length > 0 && <p className="text-center text-caption text-status-danger">{t('pa13.logoutBlocked')}</p>}
    </div>
  )
}
