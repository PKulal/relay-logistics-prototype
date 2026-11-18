/**
 * Demo toolbar (build plan Phase 1; ERP spec §11.1, extended to every app).
 * Collapsed to a small pill by default. Deliberately styled apart from the apps
 * (dark with amber) so reviewers can tell demo controls from product UI.
 */
import { CalendarClock, Clock, FlaskConical, Gauge, Repeat, RotateCcw, TriangleAlert, WifiOff, X, Tag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { APPS } from '@shared/apps'
import { useDemoNow, useFlags } from '@shared/hooks/useDemo'
import { formatDayShort, formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { ConfirmDialog } from './ConfirmDialog'
import { Switch } from './switch'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

export function DemoToolbar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const demoNow = useDemoNow()
  const flags = useFlags()
  const setFlag = useDemoStore((s) => s.setFlag)
  const sessions = useSession((s) => s.sessions)
  const { pathname } = useLocation()
  const currentApp = APPS.find((a) => pathname === a.path || pathname.startsWith(`${a.path}/`))
  const clock = `${formatDayShort(demoNow)} ${formatTime(demoNow)}`

  const advance = (minutes: number) => {
    const before = useDemoStore.getState().data.shipments
    useDemoStore.getState().advanceTime(minutes)
    const { data, demoNow: now } = useDemoStore.getState()
    const moved = Object.values(data.shipments).filter((s) => before[s.id]?.status !== s.status).length
    toast.success(t('toolbar.clockMoved', { time: `${formatDayShort(now)} ${formatTime(now)}` }), {
      description: t('toolbar.shipmentsMoved', { count: moved }),
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-caption font-semibold text-white shadow-lg hover:bg-gray-700 focus-visible:outline-brand-amber"
        aria-label={t('toolbar.open')}
      >
        <FlaskConical className="size-4 text-brand-amber" aria-hidden />
        {t('toolbar.demo')}
        <span className="tabular font-medium text-gray-100/80">{clock}</span>
      </button>
    )
  }

  return (
    <>
      <section
        aria-label={t('toolbar.title')}
        className="fixed bottom-4 left-4 z-50 w-80 rounded-xl bg-gray-900 text-white shadow-2xl [&_:focus-visible]:outline-brand-amber"
      >
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <FlaskConical className="size-4 text-brand-amber" aria-hidden />
          <h2 className="font-heading text-body font-semibold">{t('toolbar.title')}</h2>
          <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded p-1 text-gray-500 hover:text-white" aria-label={t('toolbar.close')}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-4 text-caption">
          {/* Clock */}
          <div>
            <Label icon={Clock}>{t('toolbar.clock')}</Label>
            <p className="tabular font-heading text-section font-semibold">{clock}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ToolButton icon={CalendarClock} onClick={() => advance(60)}>
                {t('toolbar.plusHour')}
              </ToolButton>
              <ToolButton icon={CalendarClock} onClick={() => advance(24 * 60)}>
                {t('toolbar.plusDay')}
              </ToolButton>
            </div>
          </div>

          {/* Switch app / persona */}
          <div>
            <Label icon={Repeat}>{t('toolbar.switchApp')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {APPS.map((a) => (
                <Link
                  key={a.id}
                  to={sessions[a.key] ? a.path : `/launch/${a.id}`}
                  data-app={a.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1.5 font-medium hover:bg-white/10',
                    currentApp?.id === a.id && 'border-brand-amber',
                  )}
                >
                  <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="truncate">{t(`${a.i18nKey}.name`)}</span>
                </Link>
              ))}
            </div>
            {currentApp && (
              <Link to={`/launch/${currentApp.id}`} className="mt-2 inline-block font-medium text-brand-amber hover:underline">
                {t('toolbar.switchPersona')}
              </Link>
            )}
          </div>

          {/* Scenario actions (arrive with their engines) */}
          <div>
            <Label icon={TriangleAlert}>{t('toolbar.scenarios')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <ComingLater phase={4}>
                <ToolButton icon={TriangleAlert} disabled>
                  {t('toolbar.injectException')}
                </ToolButton>
              </ComingLater>
              <ComingLater phase={5}>
                <ToolButton icon={Gauge} disabled>
                  {t('toolbar.runScoring')}
                </ToolButton>
              </ComingLater>
            </div>
          </div>

          {/* Switches */}
          <div className="flex flex-col gap-2">
            <SwitchRow icon={WifiOff} label={t('toolbar.offline')} checked={flags.offline} onChange={(v) => setFlag('offline', v)} />
            <SwitchRow icon={Tag} label={t('toolbar.simLabels')} checked={flags.showSimulationLabels} onChange={(v) => setFlag('showSimulationLabels', v)} />
          </div>

          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-status-danger/60 px-3 py-2 font-semibold text-red-100 hover:bg-status-danger"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t('toolbar.reset')}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('toolbar.resetTitle')}
        body={t('toolbar.resetBody')}
        confirmLabel={t('toolbar.resetConfirm')}
        destructive
        onConfirm={() => {
          useDemoStore.getState().resetDemo()
          toast.success(t('toolbar.resetDone'))
        }}
      />
    </>
  )
}

function Label({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </p>
  )
}

function ToolButton({ icon: Icon, children, ...props }: { icon: typeof Clock; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white/10 px-2 py-2 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </button>
  )
}

function SwitchRow({ icon: Icon, label, checked, onChange }: { icon: typeof Clock; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-medium">
      <Icon className="size-4 text-gray-500" aria-hidden />
      <span className="flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-brand-amber" />
    </label>
  )
}

/** Disabled control with a "comes in Phase N" tooltip. */
function ComingLater({ phase, children }: { phase: number; children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>{t('toolbar.comingInPhase', { phase })}</TooltipContent>
    </Tooltip>
  )
}
