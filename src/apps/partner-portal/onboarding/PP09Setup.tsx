/**
 * PP-09 Go-live setup — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 4 Step 6: Types A / E test the API / webhook in the sandbox
 * with test shipments; other types install the Partner App and add riders,
 * drivers and hub staff with photo and ID; training videos and practice mode
 * for scan, hand-over, seal and e-POD in Hindi and English.
 * Left out under the scope rule: status code mapping. The in-app "how do I…"
 * assistant and practice mode itself belong to the Partner App.
 * SIMULATED: sandbox key and test job, app download, practice completion.
 */
import { CheckCircle2, CircleAlert, KeyRound, Loader2, PlayCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { API_TEST_STEPS, setupReady, usesApi } from '@shared/store/partnerAgreementActions'
import type { FieldStaff, PartnerApplication } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { QrCode } from '@shared/ui/QrCode'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from '../usePartnerSession'
import { PartnerOnboardingSteps, usePartnerApplication } from './steps'

const VIDEOS = ['scan', 'handover', 'seal', 'epod'] as const
const APP_LINK = 'https://logisco.in/partner-app'

export default function PP09Setup() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const app = usePartnerApplication()
  const data = useData((d) => d)
  if (!app) return null
  const reached = ['integration', 'trial', 'live'].includes(app.status)
  const staff = Object.values(data.fieldStaff).filter((s) => s.partnerId === partner.id)
  const ready = setupReady(data, app)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('pp09.title')} subtitle={usesApi(partner) ? t('pp09.subApi') : t('pp09.subApp')} className="mb-0" />
      <PartnerOnboardingSteps app={app} current="setup" />
      {!reached ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('pp09.notYet')}</p>
      ) : (
        <>
          {usesApi(partner) ? <ApiPath app={app} /> : <AppPath partnerId={partner.id} staff={staff} />}
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="tr-h">
            <h2 id="tr-h" className="text-card-title">
              {t('pp09.training')}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {VIDEOS.map((v) => (
                <li key={v} className="flex items-center gap-3 rounded-lg border p-3">
                  <PlayCircle className="size-6 text-primary" aria-hidden />
                  <span className="flex-1 font-medium">{t(`pp09.video.${v}`)}</span>
                  <span className="text-caption text-muted-foreground">{t('pp09.languages')}</span>
                </li>
              ))}
            </ul>
            {staff.length > 0 && <p className="text-caption text-muted-foreground" data-testid="practice-count">{t('pp09.practiceCount', { n: staff.filter((s) => s.trained).length, total: staff.length })}</p>}
          </section>
          {app.status === 'integration' ? (
            <div className="flex flex-col gap-1">
              <Button size="lg" className="self-start" disabled={!ready} onClick={() => (useDemoStore.getState().markReadyForTrial(app.id, user.id), toast.success(t('pp09.trialStarted')))}>
                {t('pp09.ready')}
              </Button>
              {!ready && <p className="text-caption text-muted-foreground">{usesApi(partner) ? t('pp09.needTests') : t('pp09.needStaff')}</p>}
            </div>
          ) : (
            <Link to="/partner/onboarding" className="font-medium text-primary hover:underline">
              {t('pp09.seeTrial')}
            </Link>
          )}
        </>
      )}
    </div>
  )
}

function ApiPath({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(app.setup?.webhookUrl ?? '')
  const [shown, setShown] = useState(app.setup?.tests?.length ?? 0)
  const tests = app.setup?.tests ?? []
  const running = shown < tests.length
  const editable = app.status === 'integration'
  // Test results appear one by one (PP-09 prototype note)
  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setShown((n) => n + 1), 600)
    return () => clearTimeout(id)
  }, [running, shown])
  const run = () => {
    useDemoStore.getState().recordApiTest(app.id)
    setShown(0)
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="api-h">
      <h2 id="api-h" className="text-card-title">
        {t('pp09.api')}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {app.setup?.apiKey ? (
          <span className="tabular inline-flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5" data-testid="api-key">
            <KeyRound className="size-4" aria-hidden /> {app.setup.apiKey.slice(0, 9)}••••{app.setup.apiKey.slice(-4)}
          </span>
        ) : (
          <Button variant="outline" disabled={!editable} onClick={() => useDemoStore.getState().generateSandboxKey(app.id)}>
            <KeyRound /> {t('pp09.generateKey')} <SimulatedTag />
          </Button>
        )}
      </div>
      <Field label={t('pp09.webhook')} htmlFor="pp09-hook" hint={t('pp09.webhookHint')}>
        <div className="flex gap-2">
          <Input id="pp09-hook" value={url} disabled={!editable} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <Button variant="outline" disabled={!editable || !url.trim() || url === app.setup?.webhookUrl} onClick={() => useDemoStore.getState().setWebhook(app.id, url)}>
            {t('pp09.save')}
          </Button>
        </div>
      </Field>
      <Button className="self-start" disabled={!editable || !app.setup?.apiKey || !app.setup?.webhookUrl || running} onClick={run}>
        {running && <Loader2 className="animate-spin" />} {t('pp09.runTest')}
      </Button>
      {tests.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="api-tests">
          {API_TEST_STEPS.slice(0, running ? shown : tests.length).map((step) => {
            const r = tests.find((x) => x.step === step)!
            return (
              <li key={step} className={r.ok ? 'flex items-center gap-2 text-status-success' : 'flex items-center gap-2 text-status-danger'}>
                {r.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />} {t(`pp09.test.${step}`)} · {r.ok ? t('pp09.pass') : t('pp09.fail')}
              </li>
            )
          })}
          {!running && <li className="font-semibold">{t('pp09.passed', { n: tests.filter((x) => x.ok).length, total: tests.length })}</li>}
        </ul>
      )}
    </section>
  )
}

function AppPath({ partnerId, staff }: { partnerId: string; staff: FieldStaff[] }) {
  const { t } = useTranslation()
  const empty = { name: '', mobile: '', role: 'driver' as FieldStaff['role'], language: 'hi' as FieldStaff['language'], photo: '', idKind: 'aadhaar' as 'aadhaar' | 'dl' | 'voterId', idLast4: '' }
  const [f, setF] = useState(empty)
  const valid = f.name.trim() && /^\d{10}$/.test(f.mobile.replace(/\s/g, '')) && f.photo && /^\d{4}$/.test(f.idLast4)
  const add = () => {
    useDemoStore.getState().addFieldStaff(partnerId, { name: f.name, mobile: f.mobile, role: f.role, language: f.language, photo: f.photo, idProof: { kind: f.idKind, last4: f.idLast4 } })
    toast.success(t('pp09.staffAdded', { name: f.name.trim() }))
    setF(empty)
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="app-h">
      <h2 id="app-h" className="text-card-title">
        {t('pp09.app')}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <QrCode value={APP_LINK} label={t('pp09.qr')} className="size-28" />
        <div className="text-caption">
          <p className="font-medium">{t('pp09.download')}</p>
          <p className="text-muted-foreground">{APP_LINK}</p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t('pp09.staff', { count: staff.length })}</h3>
        {staff.length > 0 && (
          <table className="w-full text-table [&_td]:pr-4 [&_th]:pr-4" data-testid="staff">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('pp09.col.name')}</th>
                <th>{t('pp09.col.role')}</th>
                <th>{t('pp09.col.id')}</th>
                <th>{t('pp09.col.practice')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">
                    {s.name} <span className="text-caption text-muted-foreground">{s.mobile}</span>
                  </td>
                  <td>{t(`pp09.role.${s.role}`)}</td>
                  <td className="tabular">{s.idProof ? t(`pp09.idKind.${s.idProof.kind}`) + ' ••' + s.idProof.last4 : '—'}</td>
                  <td>
                    {s.trained ? (
                      <Chip tone="success">{t('pp09.practiceDone')}</Chip>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => useDemoStore.getState().completePractice(s.id)}>
                        {t('pp09.markPractice')} <SimulatedTag />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
        <legend className="px-1 font-semibold">{t('pp09.addStaff')}</legend>
        <Field label={t('pp09.col.name')} htmlFor="st-name" small>
          <Input id="st-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('pp09.mobile')} htmlFor="st-mobile" small>
          <Input id="st-mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
        </Field>
        <Field label={t('pp09.col.role')} htmlFor="st-role" small>
          <NativeSelect id="st-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as FieldStaff['role'] })}>
            {(['rider', 'driver', 'hub'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`pp09.role.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('pp09.idType')} htmlFor="st-idk" small>
          <NativeSelect id="st-idk" value={f.idKind} onChange={(e) => setF({ ...f, idKind: e.target.value as typeof f.idKind })}>
            {(['aadhaar', 'dl', 'voterId'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`pp09.idKind.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('pp09.idLast4')} htmlFor="st-id4" small>
          <Input id="st-id4" inputMode="numeric" maxLength={4} value={f.idLast4} onChange={(e) => setF({ ...f, idLast4: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label={t('pp09.language')} htmlFor="st-lang" small>
          <NativeSelect id="st-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as FieldStaff['language'] })}>
            <option value="hi">हिन्दी</option>
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </NativeSelect>
        </Field>
        <PhotoCapture label={t('pp09.photo')} caption={f.name || t('pp09.photo')} value={f.photo} onChange={(p) => setF({ ...f, photo: p })} idBase={`${partnerId}-staff`} className="sm:col-span-2" required />
        <Button className="self-end" disabled={!valid} onClick={add}>
          {t('pp09.add')}
        </Button>
      </fieldset>
    </section>
  )
}
