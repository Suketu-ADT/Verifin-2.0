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
import About from "./pages/About"
import SystemStatus from "./pages/SystemStatus"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/verify" element={<VerificationFlow />} />
          <Route path="/verify/results/:id" element={<ResultsDashboard />} />
          <Route path="/verify/results/:id/claim/:claimId" element={<ClaimDetail />} />
          <Route path="/evidence" element={<EvidenceExplorer />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/system" element={<SystemStatus />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

