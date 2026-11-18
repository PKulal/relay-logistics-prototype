/**
 * The giver's side of a hand-over while waiting (PA-19): QR + 6-digit code for
 * the receiver, and the demo button that opens the receiver's phone in a new tab.
 */
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { handoverQrValue, spacedCode } from '@shared/sim/handover'
import { QrCode } from '@shared/ui/QrCode'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

interface HandoverCodeProps {
  /** What the QR refers to: the giver's leg or the manifest */
  refId: string
  code: string
  receiverName: string
  /** Receiver's staff id and the screen to open on their phone (demo) */
  receiver?: { id: string; name: string; path: string }
}

export function HandoverCode({ refId, code, receiverName, receiver }: HandoverCodeProps) {
  const { t } = useTranslation()
  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center">
        <h2 className="font-bold">{t('pa19.codeTitle')}</h2>
        <QrCode value={handoverQrValue(refId, code)} label={t('pa19.qrLabel', { code })} className="w-44" />
        <p className="tabular text-[32px] font-bold tracking-widest" data-testid="handover-code">
          {spacedCode(code)}
        </p>
        <p className="text-muted-foreground">{t('pa19.codeHelp', { name: receiverName })}</p>
        <SimulatedTag />
      </section>
      <p className="flex items-center justify-center gap-2 font-semibold" role="status">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> {t('pa19.waiting', { name: receiverName })}
      </p>
      {receiver && (
        <button
          type="button"
          onClick={() => window.open(`/app/as/${receiver.id}?to=${encodeURIComponent(receiver.path)}`, '_blank')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-amber font-semibold"
        >
          <ExternalLink className="size-4" aria-hidden /> {t('pa19.openReceiver', { name: receiver.name })} <SimulatedTag />
        </button>
      )}
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa19.liability')}
      </p>
    </>
  )
}
