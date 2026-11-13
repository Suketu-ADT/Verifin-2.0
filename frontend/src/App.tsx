import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "./components/layout/Layout"
import LandingPage from "./pages/LandingPage"
import Dashboard from "./pages/Dashboard"
import VerificationFlow from "./pages/VerificationFlow"
import ResultsDashboard from "./pages/ResultsDashboard"
import ClaimDetail from "./pages/ClaimDetail"
import EvidenceExplorer from "./pages/EvidenceExplorer"
import History from "./pages/History"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"
import SystemStatus from "./pages/SystemStatus"
import ReviewQueue from "./pages/ReviewQueue"
import Auth from "./pages/Auth"
import Admin from "./pages/Admin"
import Account from "./pages/Account"
import Analytics from "./pages/Analytics"
import Benchmark from "./pages/Benchmark"
import { AuthProvider, RequireAuth, RequireRole } from "./lib/AuthContext"

function App() {
  return (
    <Router basename={(import.meta as any).env?.BASE_URL ?? "/"}>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        
        <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/verify" element={<VerificationFlow />} />
          <Route path="/verify/results/:id" element={<ResultsDashboard />} />
          <Route path="/verify/results/:id/claim/:claimId" element={<ClaimDetail />} />
          <Route path="/evidence" element={<EvidenceExplorer />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Account />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/benchmark" element={<Benchmark />} />
          <Route path="/system" element={<SystemStatus />} />
          <Route path="/admin" element={<RequireRole minimum="admin"><Admin /></RequireRole>} />
        </Route>
        </Route>
      </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App

