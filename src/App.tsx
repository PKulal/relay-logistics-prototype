import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import { PageSkeleton } from "@shared/ui/PageSkeleton";
import { DemoToolbar } from "@shared/ui/DemoToolbar";
import { Toaster } from "@shared/ui/sonner";
import { TooltipProvider } from "@shared/ui/tooltip";
import { AutoApprover } from "@shared/sim/AutoApprover";
import DemoSwitch from "./launcher/DemoSwitch";
import Launcher from "./launcher/Launcher";
import PersonaPicker from "./launcher/PersonaPicker";
import CP01Login, { CP03ForgotPassword } from "@apps/customer/CP01Login";
import PP01Login, { PP03ForgotPassword } from "@apps/partner-portal/PP01Login";
import ERP01Login from "@apps/erp/ERP01Login";
import { PA01Language, PA02Login } from "@apps/partner-app/PA01Welcome";

// Each app (and the public pages) is its own chunk, loaded with a skeleton
const CustomerApp = lazy(() => import("@apps/customer/CustomerApp"));
const ErpApp = lazy(() => import("@apps/erp/ErpApp"));
const PartnerAppApp = lazy(() => import("@apps/partner-app/PartnerAppApp"));
const PartnerPortalApp = lazy(
  () => import("@apps/partner-portal/PartnerPortalApp"),
);
const PP04PartnerApply = lazy(() => import("@apps/public/PP04PartnerApply"));
const CP04SignUp = lazy(() => import("@apps/public/CP04SignUp"));
const CP18Track = lazy(() => import("@apps/public/CP18Track"));

export default function App() {
  const { pathname } = useLocation();
  return (
    <TooltipProvider delayDuration={300}>
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Launcher />} />
            <Route path="/launch/:appId" element={<PersonaPicker />} />
            {/* Login screens (CP-01/03, PP-01/03, PA-01/02, ERP-01) */}
            <Route path="/customer/login" element={<CP01Login />} />
            <Route
              path="/customer/forgot-password"
              element={<CP03ForgotPassword />}
            />
            <Route path="/partner/login" element={<PP01Login />} />
            <Route
              path="/partner/forgot-password"
              element={<PP03ForgotPassword />}
            />
            <Route path="/erp/login" element={<ERP01Login />} />
            <Route path="/app/welcome" element={<PA01Language />} />
            <Route path="/app/login" element={<PA02Login />} />
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
        </Suspense>
      </ErrorBoundary>
      <DemoToolbar />
      <AutoApprover />
      <Toaster />
    </TooltipProvider>
  );
}
