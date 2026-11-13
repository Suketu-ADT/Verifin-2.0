import { useCallback, useEffect, useState } from "react"
import { Bot, Cpu, Database, Layers, RefreshCw, Server, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader, DetailRow } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { getEngineConfig, getSystemHealth, type EngineConfig, type HealthResponse } from "../lib/api"

type Tone = "ok" | "warn" | "bad" | "idle"

const TONE: Record<Tone, { dot: string; badge: "success" | "warning" | "danger" | "neutral" }> = {
  ok: { dot: "bg-supported", badge: "success" },
  warn: { dot: "bg-unverifiable", badge: "warning" },
  bad: { dot: "bg-contradicted", badge: "danger" },
  idle: { dot: "bg-faint", badge: "neutral" },
}

interface ServiceView { key: string; name: string; icon: LucideIcon; tone: Tone; state: string; detail: string }

/** Every state here comes from /system/health; while it has not answered, nothing is claimed. */
function services(health: HealthResponse | null, config: EngineConfig | null, offline: boolean): ServiceView[] {
  const s = health?.services
  const pending = !health && !offline
  const unknown = (v: string | undefined) => (pending ? "Checking…" : offline ? "Unknown" : v ?? "Unknown")
  return [
    {
      key: "backend", name: "API server", icon: Server,
      tone: s?.backend === "healthy" ? "ok" : offline ? "bad" : "idle",
      state: s?.backend === "healthy" ? "Healthy" : offline ? "Unreachable" : unknown(s?.backend),
      detail: offline ? "The browser could not reach the API." : "Answers requests from this app.",
    },
    {
      key: "database", name: "Database", icon: Database,
      tone: s?.database === "healthy" ? "ok" : s?.database === "fallback" ? "warn" : s?.database === "unhealthy" ? "bad" : "idle",
      state: s?.database === "healthy" ? "Connected" : s?.database === "fallback" ? "Local fallback" : s?.database === "unhealthy" ? "Unavailable" : unknown(s?.database),
      detail: s?.database === "fallback" ? "The cluster could not be reached, so data is held in a local file. It is not in the shared database." : "Stores documents, verifications and audit records.",
    },
    {
      key: "embedding", name: "Embedding model", icon: Layers,
      tone: s?.embedding === "healthy" ? "ok" : s?.embedding ? "bad" : "idle",
      state: s?.embedding === "healthy" ? "Ready" : s?.embedding ? "Unavailable" : unknown(s?.embedding),
      detail: config ? `${config.models.embedding}. Finds passages by meaning.` : "Finds passages by meaning.",
    },
    {
      key: "nli", name: "Inference model", icon: Cpu,
      tone: s?.nli === "healthy" ? "ok" : s?.nli ? "bad" : "idle",
      state: s?.nli === "healthy" ? "Ready" : s?.nli ? "Unavailable" : unknown(s?.nli),
      detail: config ? `${config.models.nli}. Compares claims with evidence.` : "Compares claims with evidence.",
    },
    {
      key: "llm", name: "Claim-extraction LLM", icon: Bot,
      tone: s?.llm === "ready" ? "ok" : s?.llm === "unconfigured" ? "warn" : "idle",
      state: s?.llm === "ready" ? "Configured" : s?.llm === "unconfigured" ? "Not configured" : unknown(s?.llm),
      detail: s?.llm === "unconfigured" ? "No provider key is set, so drafting claims from a document is unavailable. Pasted statements still verify." : config?.llm.provider ? `Provider: ${config.llm.provider}${config.llm.model ? ` · ${config.llm.model}` : ""}. Only splits text into claims.` : "Only splits text into claims, never decides a verdict.",
    },
  ]
}

interface Endpoint { method: "GET" | "POST"; path: string; desc: string; payload: string; admin?: boolean }

/** The routes this app calls, as registered by the API (all under /api/v1). */
const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/api/v1/documents/upload", desc: "Upload a PDF; it is parsed, OCR'd if scanned, and indexed for retrieval", payload: "file (multipart/form-data)" },
  { method: "POST", path: "/api/v1/documents/{id}/extract-facts", desc: "Draft claims from a document with the configured LLM", payload: "none" },
  { method: "POST", path: "/api/v1/verification/start", desc: "Verify an AI answer against an uploaded document", payload: "document_id, llm_output, retrieval_mode?" },
  { method: "GET", path: "/api/v1/verification", desc: "List recent verifications", payload: "limit?" },
  { method: "GET", path: "/api/v1/verification/{id}/results", desc: "Claim verdicts with evidence, rule and risk for one verification", payload: "none" },
  { method: "GET", path: "/api/v1/analytics/overview", desc: "Usage statistics over a time range", payload: "days" },
  { method: "GET", path: "/api/v1/review/queue", desc: "Uncertain scanned figures waiting for a human decision", payload: "document_id?" },
  { method: "POST", path: "/api/v1/review/{id}/decide", desc: "Record an accept, correct or reject decision", payload: "reviewer_id, action, reason, corrected_value?" },
  { method: "GET", path: "/api/v1/system/health", desc: "Status of the API, database and models", payload: "none" },
  { method: "GET", path: "/api/v1/system/llm/health", desc: "Detailed LLM provider status", payload: "none", admin: true },
]

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [config, setConfig] = useState<EngineConfig | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const poll = useCallback(() => {
    setLoading(true)
    Promise.allSettled([getSystemHealth(), getEngineConfig()]).then(([h, c]) => {
      if (h.status === "fulfilled") { setHealth(h.value); setOffline(false) } else { setHealth(null); setOffline(true) }
      if (c.status === "fulfilled") setConfig(c.value)
      setCheckedAt(new Date())
      setLoading(false)
    })
  }, [])
  useEffect(() => poll(), [poll])

  const list = services(health, config, offline)
  const overall: { tone: Tone; text: string } = offline
    ? { tone: "bad", text: "The API is unreachable" }
    : !health ? { tone: "idle", text: "Checking the engine…" }
    : health.status === "healthy" ? { tone: "ok", text: "All required services are running" }
    : { tone: "warn", text: "Degraded: one or more required services are down" }

  const columns: Column<Endpoint>[] = [
    { key: "method", header: "Method", className: "w-20", cell: (e) => <Badge tone={e.method === "POST" ? "brand" : "neutral"} className="font-mono">{e.method}</Badge> },
    { key: "path", header: "Path", cell: (e) => <code className="break-all text-xs font-medium text-ink">{e.path}</code> },
    { key: "desc", header: "Purpose", hideBelow: "md", cell: (e) => <span className="text-muted">{e.desc}{e.admin && <Badge tone="outline" className="ml-2">Admin</Badge>}</span> },
    { key: "payload", header: "Input", hideBelow: "lg", cell: (e) => <span className="font-mono text-xs text-muted">{e.payload}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        title="System status"
        subtitle="Live health of the API, database and models, read from the server when you open this page."
        actions={
          <>
            {checkedAt && <span className="num text-xs text-muted">Checked {checkedAt.toLocaleTimeString()}</span>}
            <Button size="sm" onClick={poll} loading={loading}>{!loading && <RefreshCw />} Check now</Button>
          </>
        }
      />

      <div className={cn("flex items-center gap-3 rounded-lg border p-4", overall.tone === "ok" ? "border-supported-line bg-supported-tint" : overall.tone === "warn" ? "border-unverifiable-line bg-unverifiable-tint" : overall.tone === "bad" ? "border-contradicted-line bg-contradicted-tint" : "border-line bg-surface")} role="status">
        <span className={cn("size-2.5 rounded-full", TONE[overall.tone].dot)} aria-hidden="true" />
        <span className="text-[15px] font-semibold text-ink">{overall.text}</span>
        {offline && <span className="text-[13px] text-muted">Check that the server is running and the address is correct.</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <Card key={s.key} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-subtle text-muted"><s.icon className="size-4" aria-hidden="true" /></span>
              {!health && !offline ? <Skeleton className="h-5 w-20" /> : <Badge tone={TONE[s.tone].badge}><span className={cn("size-1.5 rounded-full", TONE[s.tone].dot)} aria-hidden="true" />{s.state}</Badge>}
            </div>
            <div className="mt-3 text-[13px] font-semibold text-ink">{s.name}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.detail}</p>
          </Card>
        ))}
      </div>

      {health?.services.database === "fallback" && (
        <Notice tone="warning" title="Running on the local fallback database">
          Work done now is stored in a file on the server, not in the shared cluster. Restore the database connection before relying on this data.
        </Notice>
      )}

      {config && (
        <Card>
          <CardHeader title="Engine in use" description="Read from the server's configuration. Change these in its environment, not here." />
          <CardBody>
            <DetailRow label="Pipeline version">{config.pipeline_version}</DetailRow>
            <DetailRow label="Evidence search">{config.retrieval.mode} · {config.retrieval.fusion.toUpperCase()} · top {config.retrieval.top_k}</DetailRow>
            <DetailRow label="Disabled checks">{config.policy.disabled_checks.join(", ") || "None"}</DetailRow>
          </CardBody>
        </Card>
      )}

      <section aria-labelledby="endpoints" className="space-y-3">
        <div className="flex items-start gap-2">
          <div>
            <h2 id="endpoints" className="text-lg font-semibold tracking-tight text-ink">API reference</h2>
            <p className="text-[13px] text-muted">The main routes this app uses. When authentication is enabled on the server, every route needs a signed-in session or API key.</p>
          </div>
        </div>
        <DataTable caption="API routes used by this app" columns={columns} rows={ENDPOINTS} rowKey={(e) => `${e.method}${e.path}`} />
      </section>
    </div>
  )
}
