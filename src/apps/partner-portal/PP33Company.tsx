/**
 * PP-33 Company profile, bank and agreement — docs/02-partner-portal.md.
 * Source §4 Step 5 (rate card, agreement, payment cycle, optional deposit),
 * §5.4 (offboarding on partner request). Admin edits; Finance views. A bank
 * change needs an OTP and a new SIMULATED penny-drop. "Request exit" opens
 * the offboarding case (PP-39). Rate revision requests are not built (no
 * basis in the client document).
 */
import { Building2, FileSignature, Landmark, LogOut, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { BankChangeDialog } from '@shared/ui/BankChangeDialog'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

const card = 'rounded-xl border bg-card p-5 shadow-card'

export default function PP33Company() {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const p = data.partners[partner.id]
  const isAdmin = user.role === 'admin'
  const [bankOpen, setBankOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const coordinator = p.coordinatorId ? data.staff[p.coordinatorId] : undefined
  const rates = Object.values(data.partnerRates).filter((r) => r.partnerId === p.id)
  const openCase = Object.values(data.suspensionCases).find((c) => c.partnerId === p.id && c.step !== 'closed')
  const where = (laneOrCluster: string) => data.lanes[laneOrCluster] ? `${data.lanes[laneOrCluster].originRegion} → ${data.lanes[laneOrCluster].destRegion}` : (data.hubs[laneOrCluster]?.name ?? laneOrCluster)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp33.title')} subtitle={isAdmin ? t('pp33.subtitle') : t('pp33.viewOnly')} className="mb-0" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-label={t('pp33.company')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <Building2 className="size-5 text-muted-foreground" aria-hidden /> {t('pp33.company')}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="company">
            <dt className="text-muted-foreground">{t('pp33.name')}</dt>
            <dd>{p.name}</dd>
            <dt className="text-muted-foreground">{t('pp33.type')}</dt>
            <dd>{t('partner.typeShort', { type: p.type })}</dd>
            <dt className="text-muted-foreground">GSTIN</dt>
            <dd className="tabular">{p.gstin}</dd>
            <dt className="text-muted-foreground">PAN</dt>
            <dd className="tabular">{p.pan}</dd>
            <dt className="text-muted-foreground">{t('pp33.address')}</dt>
            <dd>{p.profile?.address ?? p.city}</dd>
            <dt className="text-muted-foreground">{t('pp33.since')}</dt>
            <dd>{p.profile ? formatDate(p.profile.onboardedOn) : '—'}</dd>
            <dt className="text-muted-foreground">{t('pp33.coordinator')}</dt>
            <dd>{coordinator?.name ?? '—'}</dd>
          </dl>
        </section>

        <section className={card} aria-label={t('pp33.bank')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <Landmark className="size-5 text-muted-foreground" aria-hidden /> {t('pp33.bank')}
          </h2>
          {p.profile ? (
            <p data-testid="bank">
              {p.profile.bank.name} ••{p.profile.bank.account.slice(-4)} <span className="text-caption text-muted-foreground">· {p.profile.bank.ifsc}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{t('pp33.noProfile')}</p>
          )}
          <p className="text-caption text-muted-foreground">{t('pp33.bankUse')}</p>
          <p className="mt-2">{t('pp33.deposit', { amount: formatINR(p.profile?.deposit ?? 0) })}</p>
          {isAdmin && p.profile && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setBankOpen(true)}>
              {t('cp33.changeBank')}
            </Button>
          )}
        </section>

        <section className={card} aria-label={t('pp33.agreement')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <FileSignature className="size-5 text-muted-foreground" aria-hidden /> {t('pp33.agreement')}
          </h2>
          <p>{p.profile ? t('pp33.signed', { date: formatDate(p.profile.agreementSignedOn) }) : '—'}</p>
          <p className="text-caption text-muted-foreground">{t('pp33.agreementNote')}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => window.print()}>
            {t('pp33.print')}
          </Button>
        </section>

        <section className={card} aria-label={t('pp33.exit')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <LogOut className="size-5 text-muted-foreground" aria-hidden /> {t('pp33.exit')}
          </h2>
          {openCase ? (
            <p>
              <Chip tone="warning">{t('pp33.caseOpen', { id: openCase.id })}</Chip>{' '}
              <Link to="/partner/case" className="text-primary hover:underline">
                {t('pp33.viewCase')}
              </Link>
            </p>
          ) : (
            <>
              <p className="text-caption text-muted-foreground">{t('pp33.exitNote')}</p>
              {isAdmin && (
                <Button className="mt-3" size="sm" variant="outline" onClick={() => setExitOpen(true)}>
                  {t('pp33.requestExit')}
                </Button>
              )}
            </>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp33.rates')}>
        <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
          <Receipt className="size-5 text-muted-foreground" aria-hidden /> {t('pp33.rates')}
        </h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="rates">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('pp33.col.leg')}</th>
              <th>{t('pp33.col.where')}</th>
              <th>{t('pp33.col.service')}</th>
              <th>{t('pp33.col.rate')}</th>
              <th>{t('pp33.col.terms')}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">{t(`legType.${r.legType}`)}</td>
                <td>{where(r.laneOrCluster)}</td>
                <td>{r.serviceKind ? t(`pp33.kind.${r.serviceKind}`) : t('pp33.kind.both')}</td>
                <td className="tabular">
                  {formatINR(r.rate)} {t(`ponb.rateUnit.${r.unit}`)}
                </td>
                <td className="text-caption text-muted-foreground">
                  {[r.maxKg && t('pp33.upTo', { kg: r.maxKg }), r.minKg && t('pp33.minKg', { kg: r.minKg }), r.minimum && t('pp33.minimum', { amount: formatINR(r.minimum) })].filter(Boolean).join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-caption text-muted-foreground">{t('pp33.ratesNote')}</p>
      </section>

      {bankOpen && <BankChangeDialog holder={p.name} mobile={user.mobile} onSubmit={(b) => useDemoStore.getState().changePartnerBank(p.id, b, user.id)} onClose={() => setBankOpen(false)} />}
      {exitOpen && <ExitDialog onClose={() => setExitOpen(false)} />}
    </div>
  )
}

function ExitDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user, partner } = usePartnerSession()
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp33.exitTitle')}</DialogTitle>
          <DialogDescription>{t('pp33.exitBody')}</DialogDescription>
        </DialogHeader>
        <Field label={t('pp33.reason')} htmlFor="x-reason" required>
          <textarea id="x-reason" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              useDemoStore.getState().requestExit(partner.id, reason, user.id)
              toast.success(t('pp33.exitSent'))
              onClose()
            }}
          >
            {t('pp33.requestExit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
