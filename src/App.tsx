import { Navigate, Route, Routes } from 'react-router-dom'
import Launcher from './launcher/Launcher'
import { AppPlaceholder } from '@shared/ui/AppPlaceholder'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Launcher />} />
      <Route path="/customer/*" element={<AppPlaceholder app="customer" />} />
      <Route path="/partner/*" element={<AppPlaceholder app="partner-portal" />} />
      <Route path="/app/*" element={<AppPlaceholder app="partner-app" />} />
      <Route path="/erp/*" element={<AppPlaceholder app="erp" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
