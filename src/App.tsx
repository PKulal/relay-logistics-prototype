import { Navigate, Route, Routes } from 'react-router-dom'
import CustomerApp from '@apps/customer/CustomerApp'
import ErpApp from '@apps/erp/ErpApp'
import PartnerAppApp from '@apps/partner-app/PartnerAppApp'
import PartnerPortalApp from '@apps/partner-portal/PartnerPortalApp'
import PP04PartnerApply from '@apps/public/PP04PartnerApply'
import { DemoToolbar } from '@shared/ui/DemoToolbar'
import { Toaster } from '@shared/ui/sonner'
import { TooltipProvider } from '@shared/ui/tooltip'
import CP04SignUp from '@apps/public/CP04SignUp'
import CP18Track from '@apps/public/CP18Track'
import { AutoApprover } from '@shared/sim/AutoApprover'
import DemoSwitch from './launcher/DemoSwitch'
import Launcher from './launcher/Launcher'
import PersonaPicker from './launcher/PersonaPicker'

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <Routes>
        <Route path="/" element={<Launcher />} />
        <Route path="/launch/:appId" element={<PersonaPicker />} />
        <Route path="/customer/*" element={<CustomerApp />} />
        <Route path="/partner/apply" element={<PP04PartnerApply />} />
        <Route path="/partner/*" element={<PartnerPortalApp />} />
        <Route path="/signup" element={<CP04SignUp />} />
        <Route path="/track" element={<CP18Track />} />
        <Route path="/track/:lr" element={<CP18Track />} />
        <Route path="/app/as/:staffId" element={<DemoSwitch />} />
        <Route path="/app/*" element={<PartnerAppApp />} />
        <Route path="/erp/*" element={<ErpApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DemoToolbar />
      <AutoApprover />
      <Toaster />
    </TooltipProvider>
  )
}
