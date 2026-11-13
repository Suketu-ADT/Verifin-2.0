import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Activity, Check, Copy, FileText, KeyRound, Users as UsersIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Field, Input, Select } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Tabs } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { PageHeading } from "@/components/shared/PageHeading"
import { MetricCard } from "@/components/shared/MetricCard"
import { DataTable, type Column } from "@/components/shared/DataTable"
import { ErrorState, Notice } from "@/components/shared/states"
import { formatDateTime, humanize } from "@/lib/format"
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
const TABS: { value: Tab; label: string; icon: typeof Activity }[] = [
  { value: "overview", label: "Overview", icon: Activity },
  { value: "people", label: "People", icon: UsersIcon },
  { value: "keys", label: "API keys", icon: KeyRound },
  { value: "audit", label: "Audit trail", icon: FileText },
]
const ROLES = ["viewer", "analyst", "admin"]

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

function SectionLoading() {
  return <div role="status" aria-label="Loading" className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, error, loading, reload } = useLoad<AdminOverview>(getAdminOverview)
  if (loading) return <SectionLoading />
  if (error || !data) return <ErrorState title="Overview unavailable" message={error ?? undefined} onRetry={() => void reload()} />
  const { usage, people, audit, instance } = data
  const instanceRows: [string, string][] = [
    ["Application", instance.app_version],
    ["Verification pipeline", instance.pipeline_version],
    ["Environment", instance.environment],
    ["Authentication", instance.auth_enabled ? "Enabled" : "Disabled (local development)"],
    ["Jobs", `${instance.jobs_running} running, ${instance.jobs_waiting} waiting (limits ${instance.max_concurrent_jobs} / ${instance.job_queue_limit})`],
    ["NLI model", instance.models.nli ?? "–"],
    ["Embedding model", instance.models.embedding ?? "–"],
    ["Reranker", instance.models.reranker ?? "Off"],
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={`Verifications (${usage.window_days} d)`} value={usage.verifications} hint={Object.entries(usage.by_status).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ") || "None yet"} />
        <MetricCard label="Average score" value={usage.average_score === null ? "–" : `${usage.average_score}%`} hint={Object.entries(usage.by_risk).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ") || undefined} />
        <MetricCard label="Documents" value={usage.documents} />
        <MetricCard label="Active users" value={`${people.active_users} / ${people.users}`} hint={`${people.api_keys_active} active API keys`} />
      </div>

      <Notice tone={audit.chain_valid ? "success" : "error"} title={audit.chain_valid ? "Audit trail intact" : `Audit trail altered at event ${audit.first_broken_seq}`}>
        <span className="num">{audit.events}</span> events. Head hash <span className="break-all font-mono text-xs text-ink">{audit.head_hash}</span>
        <span className="mt-1 block text-xs">Copy the head hash to storage outside this system to detect a full rewrite later.</span>
      </Notice>

      <Card>
        <CardHeader title="This server instance" description="Shared by all organisations on it." />
        <CardBody>
          <dl className="grid gap-x-10 sm:grid-cols-2">
            {instanceRows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px] last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words text-right font-mono text-xs text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

function PeopleTab() {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const { data, error, loading, reload } = useLoad<AuthUser[]>(listUsers)
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "analyst" })
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<AuthUser | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await createUser(form.email.trim(), form.password, form.role, form.name.trim() || undefined)
      toast({ title: "User added", description: form.email.trim(), tone: "success" })
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

  const columns: Column<AuthUser>[] = [
    {
      key: "user", header: "User", sortValue: (u) => (u.name || u.email).toLowerCase(),
      cell: (u) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{u.name || u.email}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</div>
          {u.name && <div className="text-xs text-muted">{u.email}</div>}
        </div>
      ),
    },
    {
      key: "role", header: "Role", sortValue: (u) => u.role,
      cell: (u) => (
        <Select value={u.role} disabled={u.id === me?.id} onChange={(e) => void change(u.id, { role: e.target.value })} aria-label={`Role of ${u.email}`} className="h-8 w-32 text-[13px]">
          {ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </Select>
      ),
    },
    { key: "status", header: "Status", hideBelow: "sm", sortValue: (u) => (u.is_active ? 0 : 1), cell: (u) => <Badge tone={u.is_active ? "success" : "neutral"}>{u.is_active ? "Active" : "Deactivated"}</Badge> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "right",
      cell: (u) => (
        <Button size="sm" disabled={u.id === me?.id} onClick={() => (u.is_active ? setConfirm(u) : void change(u.id, { is_active: true }))}>
          {u.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add a person" description="They sign in with this email and the temporary password, which they should change." />
        <CardBody>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Email" htmlFor="new-email"><Input id="new-email" required type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Name (optional)" htmlFor="new-name"><Input id="new-name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Temporary password" htmlFor="new-password" hint="At least 10 characters."><Input id="new-password" required type="password" minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role" htmlFor="new-role">
              <Select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select>
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" loading={busy}>Add person</Button>
            </div>
          </form>
          {formError && <Notice tone="error" className="mt-4">{formError}</Notice>}
        </CardBody>
      </Card>

      {error ? (
        <ErrorState title="People could not be loaded" message={error} onRetry={() => void reload()} />
      ) : (
        <DataTable caption="People in your organisation" columns={columns} rows={data ?? []} rowKey={(u) => u.id} loading={loading} empty="No people yet." />
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Deactivate this person?"
        description={confirm?.email}
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { const u = confirm; setConfirm(null); if (u) void change(u.id, { is_active: false }) }}>Deactivate</Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">They will no longer be able to sign in. You can reactivate them later.</p>
      </Modal>
    </div>
  )
}

// ── API keys ─────────────────────────────────────────────────────────────────

function KeysTab() {
  const { toast } = useToast()
  const { data, error, loading, reload } = useLoad<ApiKeyInfo[]>(listApiKeys)
  const [form, setForm] = useState({ name: "", role: "analyst", days: "90" })
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<ApiKeyInfo | null>(null)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const created = await createApiKey(form.name.trim(), form.role, form.days ? Number(form.days) : undefined)
      setNewKey(created.key)
      setCopied(false)
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
      toast({ title: "API key revoked", tone: "success" })
      await reload()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }
  const copy = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
    } catch {
      toast({ title: "Could not copy", description: "Select the key and copy it manually.", tone: "error" })
    }
  }

  const columns: Column<ApiKeyInfo>[] = [
    { key: "name", header: "Name", sortValue: (k) => k.name.toLowerCase(), cell: (k) => <span className="font-medium text-ink">{k.name}</span> },
    { key: "prefix", header: "Prefix", hideBelow: "sm", cell: (k) => <span className="font-mono text-xs">{k.prefix}…</span> },
    { key: "role", header: "Role", hideBelow: "md", sortValue: (k) => k.role, cell: (k) => humanize(k.role) },
    { key: "used", header: "Last used", hideBelow: "lg", sortValue: (k) => k.last_used_at ?? "", cell: (k) => (k.last_used_at ? formatDateTime(k.last_used_at) : <span className="text-muted">Never</span>) },
    { key: "expires", header: "Expires", hideBelow: "md", sortValue: (k) => k.expires_at ?? "9999", cell: (k) => (k.expires_at ? formatDateTime(k.expires_at) : <span className="text-muted">No expiry</span>) },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "right",
      cell: (k) => (k.is_active ? <Button size="sm" onClick={() => setConfirm(k)}>Revoke</Button> : <Badge tone="neutral">Revoked</Badge>),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create an API key" description={<>Use it as the <code className="rounded bg-subtle px-1 font-mono text-xs">X-API-Key</code> header, for example with <code className="rounded bg-subtle px-1 font-mono text-xs">POST /api/v1/verification/batches</code>.</>} />
        <CardBody>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Key name" htmlFor="key-name"><Input id="key-name" required placeholder="e.g. nightly batch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Role" htmlFor="key-role">
              <Select id="key-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select>
            </Field>
            <Field label="Days until expiry" htmlFor="key-days"><Input id="key-days" type="number" min={1} max={730} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" variant="primary" loading={busy}>Create key</Button></div>
          </form>
          {formError && <Notice tone="error" className="mt-4">{formError}</Notice>}
        </CardBody>
      </Card>

      {newKey && (
        <Notice tone="warning" title="Copy this key now. It is shown only once.">
          <code className="mt-2 block break-all rounded-md border border-line bg-surface p-2.5 font-mono text-xs text-ink">{newKey}</code>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => void copy()}>{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy key"}</Button>
            <Button size="sm" onClick={() => setNewKey(null)}>I have stored it</Button>
          </div>
        </Notice>
      )}

      {error ? (
        <ErrorState title="API keys could not be loaded" message={error} onRetry={() => void reload()} />
      ) : (
        <DataTable caption="API keys" columns={columns} rows={data ?? []} rowKey={(k) => k.id} loading={loading} empty="No API keys yet." />
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Revoke this API key?"
        description={confirm ? `${confirm.name} (${confirm.prefix}…)` : undefined}
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { const k = confirm; setConfirm(null); if (k) void revoke(k.id) }}>Revoke key</Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">Anything using this key stops working immediately. This cannot be undone.</p>
      </Modal>
    </div>
  )
}

// ── Audit trail ──────────────────────────────────────────────────────────────

const PAGE = 50

function AuditTab() {
  const [action, setAction] = useState("")
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chain, setChain] = useState<AuditChainStatus | null>(null)
  const [verifying, setVerifying] = useState(false)

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
    setVerifying(true)
    try {
      setChain(await verifyAuditChain())
    } catch (err) {
      setError(errorMessage(err, "Verification failed."))
    } finally {
      setVerifying(false)
    }
  }

  const columns: Column<AuditEvent>[] = [
    { key: "seq", header: "#", numeric: true, sortValue: (e) => e.seq, cell: (e) => <span className="font-mono text-xs">{e.seq}</span> },
    { key: "time", header: "Time", sortValue: (e) => e.timestamp, cell: (e) => (
      <div className="text-xs">
        <div className="whitespace-nowrap">{formatDateTime(e.timestamp)}</div>
        <div className="mt-0.5 break-all text-muted xl:hidden">{e.actor_email || e.actor_id}{e.auth_method === "api_key" && " (API key)"}</div>
      </div>
    ) },
    { key: "actor", header: "Actor", hideBelow: "xl", cell: (e) => <span className="text-xs">{e.actor_email || e.actor_id}{e.auth_method === "api_key" && <span className="ml-1 text-muted">(API key)</span>}</span> },
    { key: "action", header: "Action", cell: (e) => <span className="font-mono text-xs">{e.action}</span> },
    { key: "resource", header: "Resource", hideBelow: "xl", cell: (e) => <span className="font-mono text-xs" title={e.resource_id ?? ""}>{e.resource_type ? `${e.resource_type}:${(e.resource_id ?? "").slice(0, 8)}` : "–"}</span> },
    { key: "outcome", header: "Outcome", align: "right", cell: (e) => <Badge tone={e.outcome === "success" ? "success" : "danger"}>{humanize(e.outcome)}</Badge> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Filter by action" htmlFor="audit-action" className="w-full sm:w-80">
          <Input id="audit-action" placeholder="e.g. document.upload" value={action} onChange={(e) => setAction(e.target.value)} />
        </Field>
        <Button loading={verifying} onClick={() => void verify()}>Verify integrity</Button>
      </div>
      {chain && (
        <Notice tone={chain.valid ? "success" : "error"} title={chain.valid ? `Chain intact (${chain.events} events)` : `Broken at event ${chain.first_broken_seq}`}>
          {!chain.valid && chain.reason}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <DataTable caption="Audit events, newest first" columns={columns} rows={events} rowKey={(e) => e.id} loading={loading} empty="No events." />
      {more && !loading && <Button onClick={() => void load(false, events[events.length - 1]?.seq)}>Load older events</Button>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview")
  const { authDisabled } = useAuth()
  return (
    <div>
      <PageHeading title="Administration" subtitle="People, API keys and the audit trail of your organisation." />
      {authDisabled && (
        <Notice tone="warning" title="Authentication is switched off" className="mb-6">
          The server is running in local development, so user and API-key management is unavailable. Set AUTH_ENABLED=true to use it.
        </Notice>
      )}
      <Tabs<Tab> label="Administration sections" value={tab} onChange={setTab} tabs={TABS} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "people" && <PeopleTab />}
        {tab === "keys" && <KeysTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  )
}

