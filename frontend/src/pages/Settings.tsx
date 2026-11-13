import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CheckCircle2, LogOut, UserCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailRow, Section } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/shared/PageHeading"
import { Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/AuthContext"
import { useStoredState } from "@/lib/hooks"
import { useToast } from "@/components/ui/toast"
import { getEngineConfig, type EngineConfig } from "../lib/api"

const MODES = [
  { id: "hybrid", label: "Hybrid", desc: "Meaning and exact wording combined (recommended)" },
  { id: "dense", label: "Semantic", desc: "Matches passages by meaning" },
  { id: "bm25", label: "Keyword", desc: "Matches exact terms" },
]

export default function Settings() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, authDisabled, logout } = useAuth()
  const [retrieval, setRetrieval] = useStoredState("verifin.retrieval", "hybrid")
  const [config, setConfig] = useState<EngineConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEngineConfig().then(setConfig).catch((err: any) => setError(err?.message || "Could not load the engine configuration."))
  }, [])

  const choose = (id: string, label: string) => {
    setRetrieval(id)
    toast({ title: "Preference saved", description: `New verifications will start with ${label} evidence search.`, tone: "success" })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Settings" subtitle="Your preferences for this browser, how the verification engine is configured, and your account." />

      <div className="divide-y divide-line">
        <Section title="Profile" description="The account you are signed in with.">
          {user ? (
            <>
              <DetailRow label="Name">{authDisabled ? "Local mode" : user.name || "Not set"}</DetailRow>
              {!authDisabled && <DetailRow label="Email">{user.email}</DetailRow>}
              <DetailRow label="Role"><Badge tone="brand" className="capitalize">{authDisabled ? "Authentication off" : user.role}</Badge></DetailRow>
              {!authDisabled && (
                <div className="pt-4"><Link to="/account"><Button size="sm"><UserCircle /> Manage my account</Button></Link></div>
              )}
            </>
          ) : <Skeleton className="h-16 w-full" />}
        </Section>

        <Section title="Preferences" description="Saved in this browser only. They change how the app behaves for you, not for your organisation.">
          <fieldset>
            <legend className="text-[13px] font-medium text-ink">Default evidence search</legend>
            <p className="mt-0.5 text-xs text-muted">How new verifications look for passages in a document. You can still change it for each verification.</p>
            <div role="radiogroup" aria-label="Default evidence search" className="mt-3 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const on = retrieval === m.id
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => choose(m.id, m.label)}
                    className={cn("rounded-lg border p-3 text-left transition-colors", on ? "border-brand bg-brand-tint" : "border-line bg-surface hover:border-line-strong hover:bg-subtle")}>
                    <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink">{m.label}{on && <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />}</div>
                    <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Section>

        <Section title="Verification configuration" description="What the engine is running with right now. These values are set in the server's environment, so they are shown here but cannot be changed from the browser. Every report records the same values in its provenance block.">
          {error && <Notice tone="error" title="Engine configuration unavailable">{error}</Notice>}
          {!config && !error && <div className="space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/5" /></div>}
          {config && (
            <div>
              <Group title="Pipeline">
                <DetailRow label="Pipeline version" hint="Stamped on every verification">{config.pipeline_version}</DetailRow>
                <DetailRow label="Disabled checks">{config.policy.disabled_checks.join(", ") || "None"}</DetailRow>
              </Group>
              <Group title="Models">
                <DetailRow label="Embedding">{config.models.embedding}</DetailRow>
                <DetailRow label="Natural-language inference">{config.models.nli}</DetailRow>
                <DetailRow label="Reranker">{config.models.reranker ?? "Off"}</DetailRow>
                <DetailRow label="Claim-extraction LLM" hint="Only splits a statement into claims; never decides a verdict">{`${config.llm.provider}${config.llm.model ? ` / ${config.llm.model}` : ""}`}</DetailRow>
              </Group>
              <Group title="Retrieval">
                <DetailRow label="Mode">{config.retrieval.mode}</DetailRow>
                <DetailRow label="Fusion">{config.retrieval.fusion.toUpperCase()}</DetailRow>
                <DetailRow label="Passages per claim">{config.retrieval.top_k}</DetailRow>
              </Group>
              <Group title="Verdict policy">
                <DetailRow label="Support threshold (NLI)">{config.policy.nli_support_threshold.toFixed(2)}</DetailRow>
                <DetailRow label="Contradiction threshold (NLI)">{config.policy.nli_contradiction_threshold.toFixed(2)}</DetailRow>
                <DetailRow label="NLI aggregation">{config.policy.aggregation}</DetailRow>
                <DetailRow label="Grounded-support overlap">{config.policy.grounded_support_min_overlap.toFixed(2)}</DetailRow>
                <DetailRow label="Multi-figure support overlap">{config.policy.multi_figure_support_min_overlap.toFixed(2)}</DetailRow>
              </Group>
              <Group title="Scanned documents" last>
                <DetailRow label="OCR confidence floor" hint="Figures read below this go to the Review Queue">{config.ocr.confidence_threshold}%</DetailRow>
              </Group>
              <div className="mt-4"><Badge tone="outline">Read-only</Badge></div>
            </div>
          )}
        </Section>

        <Section title="Account" description={authDisabled ? "Authentication is switched off on this server, so there is no account to sign out of." : "Sign out of VERIFIN on this browser."}>
          {authDisabled ? (
            <p className="text-[13px] text-muted">The server is running in local mode without authentication.</p>
          ) : (
            <Button variant="danger" onClick={() => { logout(); navigate("/login") }}><LogOut /> Sign out</Button>
          )}
        </Section>
      </div>
    </div>
  )
}

function Group({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("pb-4", !last && "mb-4 border-b border-line")}>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-muted">{title}</h3>
      {children}
    </div>
  )
}
