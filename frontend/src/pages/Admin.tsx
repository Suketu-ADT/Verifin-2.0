import { useCallback, useEffect, useState } from "react"
import { Activity, FileText, KeyRound, Loader2, ShieldCheck, ShieldAlert, Users as UsersIcon } from "lucide-react"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import {
  createApiKey,
  createUser,
  errorMessage,
  getAdminOverview,
  listApiKeys,
  listAuditEvents,
  listUsers,
  revokeApiKey,
  updateUser,
  verifyAuditChain,
  type AdminOverview,
  type ApiKeyInfo,
  type AuditChainStatus,
  type AuditEvent,
} from "../lib/api"
import type { AuthUser } from "../lib/auth"
import { useAuth } from "../lib/AuthContext"

type Tab = "overview" | "people" | "keys" | "audit"
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "people", label: "People", icon: UsersIcon },
  { id: "keys", label: "API keys", icon: KeyRound },
  { id: "audit", label: "Audit trail", icon: FileText },
]
const ROLES = ["viewer", "analyst", "admin"]
const card = "glass-card rounded-2xl border border-white/10 p-5"
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never")

function Notice({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-xs text-rose-400">
      {error}
    </p>
  ) : null
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={card}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await load())
    } catch (err) {
      setError(errorMessage(err, "Could not load this section."))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, error, loading, reload }
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, error, loading } = useLoad<AdminOverview>(getAdminOverview)
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
  if (error || !data) return <Notice error={error} />
  const { usage, people, audit, instance } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={`Verifications (${usage.window_days} d)`} value={usage.verifications} hint={Object.entries(usage.by_status).map(([k, v]) => `${v} ${k}`).join(", ") || "none yet"} />
        <Stat label="Average score" value={usage.average_score === null ? "–" : `${usage.average_score}%`} hint={Object.entries(usage.by_risk).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")} />
        <Stat label="Documents" value={usage.documents} />
        <Stat label="Active users" value={`${people.active_users} / ${people.users}`} hint={`${people.api_keys_active} active API keys`} />
      </div>

      <div className={`${card} flex items-start gap-4`}>
        {audit.chain_valid ? <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-400" /> : <ShieldAlert className="mt-0.5 h-6 w-6 text-rose-400" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {audit.chain_valid ? "Audit trail intact" : `Audit trail altered at event ${audit.first_broken_seq}`}
          </div>
          <div className="text-xs text-slate-400">
            {audit.events} events. Head hash <span className="break-all font-mono">{audit.head_hash}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Copy the head hash to storage outside this system to detect a full rewrite later.</div>
        </div>
      </div>

      <div className={card}>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">This server instance (shared by all organisations on it)</div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
          {[
            ["Application", instance.app_version],
            ["Verification pipeline", instance.pipeline_version],
            ["Environment", instance.environment],
            ["Authentication", instance.auth_enabled ? "enabled" : "disabled (local development)"],
            ["Jobs", `${instance.jobs_running} running, ${instance.jobs_waiting} waiting (limits ${instance.max_concurrent_jobs} / ${instance.job_queue_limit})`],
            ["NLI model", instance.models.nli ?? "–"],
            ["Embedding model", instance.models.embedding ?? "–"],
            ["Reranker", instance.models.reranker ?? "off"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-white/5 py-1">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right font-mono text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

function PeopleTab() {
  const { user: me } = useAuth()
  const { data, error, loading, reload } = useLoad<AuthUser[]>(listUsers)
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "analyst" })
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await createUser(form.email.trim(), form.password, form.role, form.name.trim() || undefined)
      setForm({ email: "", name: "", password: "", role: "analyst" })
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const change = async (id: string, fields: { role?: string; is_active?: boolean }) => {
    setFormError(null)
    try {
      await updateUser(id, fields)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className={`${card} grid gap-3 sm:grid-cols-5`}>
        <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="sm:col-span-2" aria-label="Email" />
        <Input placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
        <Input required type="password" minLength={10} placeholder="Temporary password (10+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Temporary password" />
        <div className="flex gap-2">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Role" className="h-8 flex-1 rounded-lg border border-white/15 bg-black/30 px-2 text-sm text-white">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        </div>
        <div className="sm:col-span-5"><Notice error={formError} /></div>
      </form>

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Notice error={error} />}
      {data && (
        <div className={`${card} overflow-x-auto p-0`}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => {
                const self = u.id === me?.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="text-sm text-white">{u.name || u.email}</div>
                      {u.name && <div className="text-xs text-slate-400">{u.email}</div>}
                    </TableCell>
                    <TableCell>
                      <select value={u.role} disabled={self} onChange={(e) => change(u.id, { role: e.target.value })} aria-label={`Role of ${u.email}`} className="h-7 rounded-md border border-white/15 bg-black/30 px-2 text-xs text-white disabled:opacity-50">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </TableCell>
                    <TableCell><Badge variant="outline">{u.is_active ? "active" : "deactivated"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={self} onClick={() => change(u.id, { is_active: !u.is_active })}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── API keys ─────────────────────────────────────────────────────────────────

function KeysTab() {
  const { data, error, loading, reload } = useLoad<ApiKeyInfo[]>(listApiKeys)
  const [form, setForm] = useState({ name: "", role: "analyst", days: "90" })
  const [newKey, setNewKey] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const created = await createApiKey(form.name.trim(), form.role, form.days ? Number(form.days) : undefined)
      setNewKey(created.key)
      setForm({ ...form, name: "" })
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const revoke = async (id: string) => {
    setFormError(null)
    try {
      await revokeApiKey(id)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className={`${card} grid gap-3 sm:grid-cols-4`}>
        <Input required placeholder="Key name (e.g. nightly batch)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="sm:col-span-2" aria-label="Key name" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Key role" className="h-8 rounded-lg border border-white/15 bg-black/30 px-2 text-sm text-white">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-2">
          <Input type="number" min={1} max={730} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} aria-label="Days until expiry" />
          <Button type="submit" disabled={busy}>{busy ? "…" : "Create"}</Button>
        </div>
        <div className="sm:col-span-4"><Notice error={formError} /></div>
      </form>

      {newKey && (
        <div role="status" className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold text-amber-200">Copy this key now. It is shown only once.</div>
          <code className="mt-2 block break-all rounded bg-black/40 p-2 font-mono text-xs text-white">{newKey}</code>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => navigator.clipboard?.writeText(newKey)}>Copy</Button>
            <Button size="sm" variant="outline" onClick={() => setNewKey(null)}>I have stored it</Button>
          </div>
          <p className="mt-2 text-xs text-slate-300">Use it as the <code>X-API-Key</code> header, e.g. with <code>POST /api/v1/verification/batches</code>.</p>
        </div>
      )}

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Notice error={error} />}
      {data && (
        <div className={`${card} overflow-x-auto p-0`}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Prefix</TableHead><TableHead>Role</TableHead><TableHead>Last used</TableHead><TableHead>Expires</TableHead><TableHead className="text-right"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-slate-400">No API keys yet.</TableCell></TableRow>}
              {data.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="text-sm text-white">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell>{k.role}</TableCell>
                  <TableCell className="text-xs">{when(k.last_used_at)}</TableCell>
                  <TableCell className="text-xs">{k.expires_at ? when(k.expires_at) : "no expiry"}</TableCell>
                  <TableCell className="text-right">
                    {k.is_active ? <Button size="sm" variant="outline" onClick={() => revoke(k.id)}>Revoke</Button> : <Badge variant="outline">revoked</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── Audit trail ──────────────────────────────────────────────────────────────

function AuditTab() {
  const [action, setAction] = useState("")
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chain, setChain] = useState<AuditChainStatus | null>(null)
  const PAGE = 50

  const load = useCallback(async (reset: boolean, before?: number) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await listAuditEvents({ action: action.trim() || undefined, limit: PAGE, before_seq: before })
      setEvents((prev) => (reset ? rows : [...prev, ...rows]))
      setMore(rows.length === PAGE)
    } catch (err) {
      setError(errorMessage(err, "Could not load the audit trail."))
    } finally {
      setLoading(false)
    }
  }, [action])

  useEffect(() => {
    void load(true)
  }, [load])

  const verify = async () => {
    setError(null)
    try {
      setChain(await verifyAuditChain())
    } catch (err) {
      setError(errorMessage(err, "Verification failed."))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Filter by action, e.g. document.upload" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" aria-label="Filter by action" />
        <Button variant="outline" onClick={verify}>Verify integrity</Button>
        {chain && (
          <span role="status" className={`text-xs ${chain.valid ? "text-emerald-400" : "text-rose-400"}`}>
            {chain.valid ? `Chain intact (${chain.events} events)` : `Broken at event ${chain.first_broken_seq}: ${chain.reason}`}
          </span>
        )}
      </div>
      <Notice error={error} />
      <div className={`${card} overflow-x-auto p-0`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>#</TableHead><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Outcome</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.seq}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{when(e.timestamp)}</TableCell>
                <TableCell className="text-xs">{e.actor_email || e.actor_id}{e.auth_method === "api_key" && <span className="ml-1 text-slate-500">(key)</span>}</TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell className="max-w-[14rem] truncate font-mono text-xs" title={e.resource_id ?? ""}>{e.resource_type ? `${e.resource_type}:${(e.resource_id ?? "").slice(0, 8)}` : "–"}</TableCell>
                <TableCell><Badge variant="outline" className={e.outcome === "success" ? "" : "border-rose-400/40 text-rose-300"}>{e.outcome}</Badge></TableCell>
              </TableRow>
            ))}
            {!loading && events.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-slate-400">No events.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
      {more && !loading && <Button variant="outline" onClick={() => load(false, events[events.length - 1]?.seq)}>Load older events</Button>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview")
  const { authDisabled } = useAuth()
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Administration</h1>
        <p className="text-sm text-slate-400">People, API keys and the audit trail of your organisation.</p>
      </div>
      {authDisabled && (
        <p role="note" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          The server is running with authentication switched off (local development), so user and API-key management is unavailable. Set AUTH_ENABLED=true to use it.
        </p>
      )}
      <div role="tablist" className="flex gap-1 border-b border-white/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors ${tab === id ? "border-amber-400 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "overview" && <OverviewTab />}
        {tab === "people" && <PeopleTab />}
        {tab === "keys" && <KeysTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  )
}
