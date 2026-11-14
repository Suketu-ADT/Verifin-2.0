import { lazy, Suspense } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "./components/layout/Layout"
import LandingPage from "./pages/LandingPage"
import { AuthProvider, RequireAuth, RequireRole } from "./lib/AuthContext"

// Every page except the landing page loads on demand, so the first visit downloads only what it shows.
// (The charts, PDF viewer and the heavy pages stay out of the entry bundle.)
const Auth = lazy(() => import("./pages/Auth"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const VerificationFlow = lazy(() => import("./pages/VerificationFlow"))
const ResultsDashboard = lazy(() => import("./pages/ResultsDashboard"))
const ClaimDetail = lazy(() => import("./pages/ClaimDetail"))
const EvidenceExplorer = lazy(() => import("./pages/EvidenceExplorer"))
const History = lazy(() => import("./pages/History"))
const Reports = lazy(() => import("./pages/Reports"))
const Settings = lazy(() => import("./pages/Settings"))
const SystemStatus = lazy(() => import("./pages/SystemStatus"))
const ReviewQueue = lazy(() => import("./pages/ReviewQueue"))
const Admin = lazy(() => import("./pages/Admin"))
const Account = lazy(() => import("./pages/Account"))
const Analytics = lazy(() => import("./pages/Analytics"))
const Benchmark = lazy(() => import("./pages/Benchmark"))

/** Shown for the instant a page's code is being fetched; the page itself brings its own skeletons. */
function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
      Loading…
    </div>
  )
}

function App() {
  return (
    <Router basename={(import.meta as any).env?.BASE_URL ?? "/"}>
      <AuthProvider>
      <Suspense fallback={<PageLoading />}>
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
      </Suspense>
      </AuthProvider>
    </Router>
  )
}

export default App
