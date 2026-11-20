/**
 * AI assistant panel (CP-35, PP-37, PA-11, ERP-02): messages, suggestion
 * chips, text (max 500) and a mic. Answers come from engines/assistant.ts
 * (SIMULATED AI) and read the shared data. Anything that acts is prepared
 * here and confirmed by the person; prepared actions go to the AI decision
 * log (ERP-43) and are marked accepted on Confirm (source §12 guardrails).
 */
import { Bot, Mic, Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import i18n from '@shared/i18n'
import { cn } from '@/shared/lib/utils'
import { answer, CHIPS, MAX_CHARS, type AssistantCard, type AssistantCtx, type Lang, type Reply, type Row } from '@shared/engines/assistant'
import { useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { listen, speak } from '@shared/sim/speech'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { Button } from '@shared/ui/button'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'

type Msg = { id: number; from: 'me'; text: string } | { id: number; from: 'ai'; reply: Reply; decisionId?: string; done?: string }

/** Values in a reply that need words (status, KPI, document, tier) are translated in the reply's language. */
function words(lang: Lang, params: Record<string, unknown> = {}) {
  const t = i18n.getFixedT(lang)
  const out: Record<string, unknown> = { ...params }
  if (typeof params.status === 'string') out.status = t(`status.shipment.${params.status}`)
  if (typeof params.kpi === 'string') out.kpi = t(`kpi.${params.kpi}`)
  if (typeof params.doc === 'string') out.doc = t(`pp32.kind.${params.doc}`)
  if (typeof params.tier === 'string') out.tier = t(`tier.${params.tier}`)
  return out
}
const say = (lang: Lang, key: string, params?: Record<string, unknown>) => i18n.getFixedT(lang)(key, words(lang, params)) as string

export function AssistantChat({ ctx, voice = false, className }: { ctx: AssistantCtx; voice?: boolean; className?: string }) {
  const { t } = useTranslation()
  const now = useDemoNow()
  const screen = useSession((s) => s.language) as Lang
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const next = useRef(1)

  useEffect(() => {
    // Block body: in newer browsers scrollIntoView returns a Promise, which an effect must not return
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [msgs])

  const ask = (q: string) => {
    const question = q.trim().slice(0, MAX_CHARS)
    if (!question) return
    const store = useDemoStore.getState()
    const reply = answer(store.data, question, ctx, now, screen)
    // Prepared actions are logged with their confidence; Confirm marks them accepted (ERP-43)
    const decisionId = reply.prepares ? store.logAssistant(ctx.app, reply.intent, reply.recordId ?? reply.intent, reply.confidence) : undefined
    setMsgs((m) => [...m, { id: next.current++, from: 'me', text: question }, { id: next.current++, from: 'ai', reply, decisionId }])
    setText('')
    if (voice) speak(say(reply.lang, reply.key, reply.params), reply.lang)
  }

  const mic = async () => {
    setListening(true)
    const heard = await listen(screen)
    setListening(false)
    if (heard) return ask(heard)
    // SIMULATED: no speech recognition here, so the first suggestion is "heard"
    toast.info(t('ai.voiceSim'))
    ask(t(`ai.chip.${ctx.app}.${CHIPS[ctx.app][0]}`))
  }

  const confirmDone = (id: number, decisionId: string | undefined, doneKey: string, lang: Lang, params?: Record<string, unknown>) => {
    if (decisionId) useDemoStore.getState().acceptAssistant(decisionId, ctx.userId)
    setMsgs((m) => m.map((x) => (x.id === id && x.from === 'ai' ? { ...x, done: say(lang, doneKey, params) } : x)))
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" data-testid="assistant-messages">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <Sparkles className="size-8 text-primary" aria-hidden />
            <p>{t(`ai.hello.${ctx.app}`)}</p>
          </div>
        )}
        <ol className="flex flex-col gap-3">
          {msgs.map((m) =>
            m.from === 'me' ? (
              <li key={m.id} className="max-w-[85%] self-end rounded-2xl bg-primary px-3 py-2 text-primary-foreground">
                {m.text}
              </li>
            ) : (
              <li key={m.id} className="flex max-w-[95%] flex-col gap-2 self-start rounded-2xl border bg-card px-3 py-2">
                <p className="flex items-start gap-2">
                  <Bot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{say(m.reply.lang, m.reply.key, m.reply.params)}</span>
                </p>
                {m.reply.cards?.map((c, i) => <Card key={i} card={c} lang={m.reply.lang} msgId={m.id} decisionId={m.decisionId} done={m.done} userId={ctx.userId} onDone={confirmDone} />)}
                {m.done && <Chip tone="success">{m.done}</Chip>}
                {m.reply.link && <LinkButton to={m.reply.link.to} label={say(m.reply.lang, m.reply.link.key)} />}
              </li>
            ),
          )}
        </ol>
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t pt-2" aria-label={t('ai.suggestions')}>
        {CHIPS[ctx.app].map((c) => (
          <button key={c} type="button" onClick={() => ask(t(`ai.chip.${ctx.app}.${c}`))} className="min-h-9 rounded-full border bg-background px-3 text-caption font-medium hover:bg-accent">
            {t(`ai.chip.${ctx.app}.${c}`)}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
      >
        <Button type="button" variant="outline" size="icon" aria-label={t('ai.mic')} onClick={() => void mic()} className={cn(listening && 'animate-pulse border-primary text-primary')}>
          <Mic />
        </Button>
        <input
          aria-label={t('ai.ask')}
          placeholder={t('ai.placeholder')}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" aria-label={t('ai.send')} disabled={!text.trim()}>
          <Send />
        </Button>
      </form>
      <p className="pt-1 text-[11px] text-muted-foreground">{t('ai.guardrail')}</p>
    </div>
  )
}

function LinkButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <Button size="sm" variant="outline" className="self-start" onClick={() => navigate(to)}>
      {label}
    </Button>
  )
}

function RowItem({ row, lang }: { row: Row; lang: Lang }) {
  const navigate = useNavigate()
  const label = say(lang, row.key, row.params)
  return row.to ? (
    <li>
      <button type="button" className="text-left text-primary hover:underline" onClick={() => navigate(row.to!)}>
        {label}
      </button>
    </li>
  ) : (
    <li>{label}</li>
  )
}

function Card({ card, lang, msgId, decisionId, done, userId, onDone }: { card: AssistantCard; lang: Lang; msgId: number; decisionId?: string; done?: string; userId: string; onDone: (id: number, decisionId: string | undefined, key: string, lang: Lang, params?: Record<string, unknown>) => void }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(card.kind === 'slots' ? card.dates[0] : '')
  const [slot, setSlot] = useState(card.kind === 'slots' ? card.slots[1]?.from ?? card.slots[0].from : '')
  const tl = i18n.getFixedT(lang)

  if (card.kind === 'shipment')
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-caption" data-testid="ai-shipment">
        <span className="tabular font-semibold">{card.lr}</span>
        <Chip tone="info">{tl(`status.shipment.${card.status}`)}</Chip>
        <span>{tl('ai.eta', { date: formatDate(card.eta) })}</span>
        <Button size="sm" variant="ghost" onClick={() => navigate(card.to)}>
          {tl('ai.open.shipment')}
        </Button>
      </div>
    )
  if (card.kind === 'list')
    return (
      <ul className="flex list-disc flex-col gap-1 pl-5 text-caption" data-testid="ai-list">
        {card.rows.map((r, i) => (
          <RowItem key={i} row={r} lang={lang} />
        ))}
      </ul>
    )
  if (card.kind === 'steps')
    return (
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-caption" data-testid="ai-steps">
        {card.keys.map((k) => (
          <li key={k}>{tl(k)}</li>
        ))}
      </ol>
    )
  if (card.kind === 'claim')
    return (
      <Button size="sm" className="self-start" disabled={!!done} onClick={() => (onDone(msgId, decisionId, 'ai.c.claimOpened', lang, { lr: card.lr }), navigate(card.to))}>
        {tl('ai.c.claimConfirm')}
      </Button>
    )
  // Reschedule: the person picks and confirms; the store runs the normal NDR reattempt (CP-21)
  const s = card.slots.find((x) => x.from === slot)!
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2" data-testid="ai-slots">
      <div className="flex flex-wrap gap-2">
        <NativeSelect aria-label={tl('ai.date')} value={date} disabled={!!done} onChange={(e) => setDate(e.target.value)} className="h-9 w-40">
          {card.dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={tl('ai.slot')} value={slot} disabled={!!done} onChange={(e) => setSlot(e.target.value)} className="h-9 w-36">
          {card.slots.map((x) => (
            <option key={x.from} value={x.from}>
              {x.from}–{x.to}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        size="sm"
        className="self-start"
        disabled={!!done}
        onClick={() => {
          useDemoStore.getState().respondNdr(card.lr, { kind: 'reattempt', date, from: s.from, to: s.to }, userId)
          onDone(msgId, decisionId, 'ai.c.rescheduled', lang, { lr: card.lr, date: formatDate(date), from: s.from, to: s.to })
        }}
      >
        {tl('ai.confirm')}
      </Button>
    </div>
  )
}

/** Floating button + side panel for the three web apps. */
export function AssistantLauncher({ ctx }: { ctx: AssistantCtx }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('ai.openPanel')}
        className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover print:hidden"
      >
        <Sparkles className="size-6" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-4 sm:max-w-md">
          <SheetHeader className="p-0 pb-2">
            <SheetTitle className="flex items-center gap-2">
              {t('ai.title')} <SimulatedTag />
            </SheetTitle>
            <SheetDescription>{t(`ai.sub.${ctx.app}`)}</SheetDescription>
          </SheetHeader>
          <AssistantChat ctx={ctx} className="flex-1" />
        </SheetContent>
      </Sheet>
    </>
  )
}
