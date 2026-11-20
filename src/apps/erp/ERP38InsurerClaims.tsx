/**
 * ERP-38 Insurer claims — docs/04-erp-control-tower.md. Source §11 Dept 10
 * (insurer claims), §13 (Insurance API). Settled customer claims whose insurer
 * share isn't filed can be filed here (SIMULATED insurance API); the officer
 * records the survey, approval and payment (UTR).
 */
import { FileUp, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { fileableClaims } from '@shared/store/insurerActions'
import type { InsurerClaim } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { KpiTile } from '@shared/ui/KpiTile'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useErpSession } from './useErpSession'

const TONE: Record<InsurerClaim['status'], Tone> = { filed: 'info', underSurvey: 'warning', approved: 'success', paid: 'success', rejected: 'danger' }
const NEXT: Partial<Record<InsurerClaim['status'], InsurerClaim['status']>> = { filed: 'underSurvey', underSurvey: 'approved', approved: 'paid' }

export default function ERP38InsurerClaims() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const list = Object.values(data.insurerClaims).sort((a, b) => b.filedAt.localeCompare(a.filedAt))
  const fileable = fileableClaims(data)
  const [filing, setFiling] = useState(false)
  const [moving, setMoving] = useState<{ c: InsurerClaim; to: InsurerClaim['status'] }>()
  const sum = (s: InsurerClaim['status'][]) => list.filter((c) => s.includes(c.status)).reduce((n, c) => n + (c.approvedAmount ?? c.amount), 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp38.title')}
        subtitle={t('erp38.subtitle')}
        actions={
          <Button disabled={!fileable.length} onClick={() => setFiling(true)}>
            <FileUp /> {t('erp38.file', { count: fileable.length })}
          </Button>
        }
        className="mb-0"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile label={t('erp38.k.open')} value={formatINR(sum(['filed', 'underSurvey', 'approved']))} />
        <KpiTile label={t('erp38.k.paid')} value={formatINR(sum(['paid']))} />
        <KpiTile label={t('erp38.k.rejected')} value={formatINR(sum(['rejected']))} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('erp38.empty')} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="insurer-claims">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp38.col.no')}</th>
                <th>{t('erp38.col.claims')}</th>
                <th>{t('erp38.col.amount')}</th>
                <th>{t('erp38.col.filed')}</th>
                <th>{t('erp38.col.status')}</th>
                <th className="sr-only">{t('erp38.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b last:border-0" aria-label={c.id}>
                  <td className="tabular px-4 py-2 font-medium">
                    {c.id}
                    <span className="block text-caption font-normal text-muted-foreground">
                      {c.insurer} · {c.policyNo}
                    </span>
                  </td>
                  <td>
                    {c.claimIds.map((id) => (
                      <Link key={id} to={`/erp/claims/${id}`} className="tabular mr-2 text-primary hover:underline">
                        {id}
                      </Link>
                    ))}
                  </td>
                  <td className="tabular">
                    {formatINR(c.amount)}
                    {c.approvedAmount != null && c.approvedAmount !== c.amount && <span className="block text-caption text-muted-foreground">{t('erp38.approvedAmt', { amount: formatINR(c.approvedAmount) })}</span>}
                  </td>
                  <td className="tabular">{formatDate(c.filedAt)}</td>
                  <td>
                    <Chip tone={TONE[c.status]}>{t(`erp38.st.${c.status}`)}</Chip>
                    {c.utr && <span className="tabular block text-caption text-muted-foreground">UTR {c.utr}</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      {NEXT[c.status] && (
                        <Button size="sm" variant="outline" onClick={() => setMoving({ c, to: NEXT[c.status]! })}>
                          {t(`erp38.to.${NEXT[c.status]}`)}
                        </Button>
                      )}
                      {(c.status === 'filed' || c.status === 'underSurvey') && (
                        <Button size="sm" variant="ghost" onClick={() => setMoving({ c, to: 'rejected' })}>
                          {t('erp38.to.rejected')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {filing && (
        <FileDialog
          onClose={() => setFiling(false)}
          onFile={(ids) => {
            const id = useDemoStore.getState().fileInsurerClaim(ids, user.id)
            if (id) toast.success(t('erp38.filed', { id }))
            setFiling(false)
          }}
        />
      )}
      {moving && (
        <MoveDialog
          c={moving.c}
          to={moving.to}
          onClose={() => setMoving(undefined)}
          onSave={(note, amount) => {
            useDemoStore.getState().advanceInsurerClaim(moving.c.id, moving.to, note, user.id, amount)
            toast.success(t('erp38.moved', { id: moving.c.id, status: t(`erp38.st.${moving.to}`) }))
            setMoving(undefined)
          }}
        />
      )}
    </div>
  )
}

function FileDialog({ onClose, onFile }: { onClose: () => void; onFile: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const fileable = fileableClaims(data)
  const [ids, setIds] = useState<string[]>(fileable.map((c) => c.id))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('erp38.fileTitle')} <SimulatedTag />
          </DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {fileable.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2">
                <Checkbox checked={ids.includes(c.id)} onCheckedChange={(v) => setIds(v ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />
                <span className="tabular">{c.id}</span> · {formatINR(c.recovery.insurer)}
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!ids.length} onClick={() => onFile(ids)}>
            {t('erp38.fileNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({ c, to, onClose, onSave }: { c: InsurerClaim; to: InsurerClaim['status']; onClose: () => void; onSave: (note: string, amount?: number) => void }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState(String(c.amount))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('erp38.moveTitle', { id: c.id, status: t(`erp38.st.${to}`) })}</DialogTitle>
        </DialogHeader>
        {to === 'approved' && (
          <Field label={t('erp38.approvedLabel')} htmlFor="ic-amt" required>
            <Input id="ic-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <Field label={t(to === 'rejected' ? 'erp38.reason' : 'erp38.note')} htmlFor="ic-note" required={to === 'rejected'}>
          <Input id="ic-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={to === 'rejected' ? 'destructive' : 'default'} disabled={to === 'rejected' && !note.trim()} onClick={() => onSave(note, to === 'approved' ? Number(amount) : undefined)}>
            {t(`erp38.to.${to}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
