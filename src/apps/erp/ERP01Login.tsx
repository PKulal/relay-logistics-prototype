/**
 * ERP-01 Staff login (SSO + two-factor) — docs/04-erp-control-tower.md.
 * Source §14 (single sign-on, two-factor login for staff). SIMULATED: the
 * company-account button lists the staff (role chips, spec prototype note);
 * the second factor is 123456. Every login is audited.
 */
import { Building2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import type { ErpRole, StaffUser } from '@shared/types'
import { AuthShell, LanguageSelect } from '@shared/ui/auth/AuthShell'
import { OtpStep } from '@shared/ui/auth/OtpStep'
import { Button } from '@shared/ui/button'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

/** Role chips in the spec's order. */
const ROLES: ErpRole[] = ['leadership', 'controlTower', 'partnerManagement', 'networkPlanning', 'pricing', 'sales', 'finance', 'claims', 'customerSuccess', 'compliance', 'hubOps', 'hubAuditor', 'superAdmin']

export default function ERP01Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const staff = useData((d) => d.staff)
  const login = useSession((s) => s.login)
  const [sso, setSso] = useState(false)
  const [who, setWho] = useState<StaffUser>()
  const people = ROLES.map((r) => Object.values(staff).find((s) => s.role === r && s.status !== 'disabled')).filter((s): s is StaffUser => !!s)

  return (
    <AuthShell app="erp" title={t('auth.erp.title')} subtitle={t('auth.erp.subtitle')}>
      {who ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-5 text-status-success" aria-hidden /> {t('auth.erp.second', { name: who.name })}
          </p>
          <OtpStep
            onVerified={() => {
              login('erp', who.id)
              useDemoStore.getState().recordLogin('erp', who.id)
              toast.success(t('login.welcome', { name: who.name }))
              navigate('/erp')
            }}
            onBack={() => setWho(undefined)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Button size="lg" variant="outline" className="justify-start" onClick={() => setSso(true)}>
            <Building2 /> {t('auth.erp.sso')} <SimulatedTag />
          </Button>
          {sso && (
            <div className="flex flex-col gap-2 rounded-xl border p-3" aria-label={t('auth.erp.pick')}>
              <span className="text-caption text-muted-foreground">{t('auth.erp.pick')}</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {people.map((p) => (
                  <button key={p.id} type="button" onClick={() => setWho(p)} className="rounded-lg border bg-background p-2 text-left hover:bg-accent">
                    <span className="block font-medium">{t(`roles.erp.${p.role}`)}</span>
                    <span className="block text-caption text-muted-foreground">
                      {p.name} · {p.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <LanguageSelect className="w-44" />
          <p className="text-caption text-muted-foreground">{t('auth.erp.note')}</p>
        </div>
      )}
    </AuthShell>
  )
}
