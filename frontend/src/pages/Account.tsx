import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BadgeCheck, ChevronRight, KeyRound, Loader2, LogOut, Mail, ShieldAlert, UserCircle } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { PasswordResetForm } from "../components/PasswordResetForm"
import { useAuth } from "../lib/AuthContext"
import { changePasswordRequest, errorMessage, fetchAuthOptions, revokeOtherSessions, updateProfile, type AuthOptions } from "../lib/api"

const FIELD = "h-10 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm"
const SAVE = "h-9 px-4 text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none"

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-white/5 py-2.5 last:border-0">
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      <div className="text-xs text-slate-200 text-right break-all">{children}</div>
    </div>
  )
}

function Pill({ tone, children }: { tone: "good" | "warn" | "muted"; children: React.ReactNode }) {
  const style =
    tone === "good" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : tone === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-white/10 bg-white/5 text-slate-400"
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>{children}</span>
}

function when(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function Account() {
  const { user, authDisabled, applySession, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [options, setOptions] = useState<AuthOptions | null>(null)
  useEffect(() => {
    fetchAuthOptions().then(setOptions).catch(() => setOptions(null))
  }, [])

  // profile
  const [name, setName] = useState(user?.name ?? "")
  const [nameBusy, setNameBusy] = useState(false)
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string } | null>(null)

  // change password
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const [pwNote, setPwNote] = useState<{ ok: boolean; text: string } | null>(null)

  // set a password (accounts made with Google or an emailed code), sessions
  const [settingPassword, setSettingPassword] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionNote, setSessionNote] = useState<{ ok: boolean; text: string } | null>(null)

  if (!user) return null

  if (authDisabled) {
    return (
      <div className="mx-auto max-w-2xl glass-card p-6 text-sm text-slate-300">
        Accounts are switched off on this server (local development), so there is no account to manage.
      </div>
    )
  }

  const rules = { length: next.length >= 10, number: /\d/.test(next), upperLower: /[a-z]/.test(next) && /[A-Z]/.test(next) }
  const strong = rules.length && rules.number && rules.upperLower

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === user.name || nameBusy) return
    setNameBusy(true)
    setNameNote(null)
    try {
      updateUser(await updateProfile(trimmed))
      setNameNote({ ok: true, text: "Name updated." })
    } catch (err) {
      setNameNote({ ok: false, text: errorMessage(err, "Could not update the name.") })
    } finally {
      setNameBusy(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || !strong || next !== confirm || pwBusy) return
    setPwBusy(true)
    setPwNote(null)
    try {
      applySession(await changePasswordRequest(current, next))
      setCurrent("")
      setNext("")
      setConfirm("")
      setPwNote({ ok: true, text: "Password changed. Every other session was signed out." })
    } catch (err) {
      setPwNote({ ok: false, text: errorMessage(err, "Could not change the password.") })
    } finally {
      setPwBusy(false)
    }
  }

  const signOutElsewhere = async () => {
    if (sessionBusy) return
    setSessionBusy(true)
    setSessionNote(null)
    try {
      applySession(await revokeOtherSessions())
      setSessionNote({ ok: true, text: "Signed out everywhere else. This browser stays signed in." })
    } catch (err) {
      setSessionNote({ ok: false, text: errorMessage(err, "Could not sign out the other sessions.") })
    } finally {
      setSessionBusy(false)
    }
  }

  const hasPassword = user.has_password !== false

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>VERIFIN</span>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-amber-400">Account</span>
        </div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white">
          <UserCircle className="h-5 w-5 text-amber-400" /> My Account
        </h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-400">Your profile, how you sign in, and where you are signed in.</p>
      </div>

      <Section title="Profile" icon={<UserCircle className="h-3.5 w-3.5" />}>
        <form onSubmit={saveName} className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300" htmlFor="account-name">Name</label>
            <Input id="account-name" value={name} onChange={(e) => { setName(e.target.value); setNameNote(null) }} maxLength={120} className={FIELD} />
          </div>
          <Button type="submit" disabled={nameBusy || !name.trim() || name.trim() === user.name} className={SAVE}>
            {nameBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
        {nameNote && <p role="status" className={`mb-2 text-xs ${nameNote.ok ? "text-emerald-400" : "text-rose-400"}`}>{nameNote.text}</p>}
        <Fact label="Email">
          {user.email} <span className="ml-1">{user.email_verified ? <Pill tone="good">Verified</Pill> : <Pill tone="warn">Not verified</Pill>}</span>
        </Fact>
        <Fact label="Role"><span className="font-mono uppercase text-amber-300">{user.role}</span></Fact>
        <Fact label="Organisation"><span className="font-mono text-slate-400">{user.tenant_id.slice(0, 8)}</span></Fact>
        <Fact label="Last sign-in">{when(user.last_login_at)}</Fact>
        <Fact label="Member since">{when(user.created_at)}</Fact>
      </Section>

      <Section title="How you sign in" icon={<BadgeCheck className="h-3.5 w-3.5" />}>
        <Fact label="Password">{hasPassword ? <Pill tone="good">Set</Pill> : <Pill tone="muted">Not set</Pill>}</Fact>
        <Fact label="Google">
          {user.google_linked ? <Pill tone="good">Linked</Pill> : <Pill tone="muted">Not linked</Pill>}
          {!user.google_linked && options?.google_client_id && (
            <div className="mt-1 text-[11px] text-slate-500">Sign in with Google once, using {user.email}, and it links itself.</div>
          )}
        </Fact>
        <Fact label="Emailed code">{options ? (options.email_otp ? <Pill tone="good">Available</Pill> : <Pill tone="muted">Not available on this server</Pill>) : "—"}</Fact>
      </Section>

      <Section title={hasPassword ? "Change password" : "Set a password"} icon={<KeyRound className="h-3.5 w-3.5" />}>
        {hasPassword ? (
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300" htmlFor="current-password">Current password</label>
              <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300" htmlFor="new-password">New password</label>
              <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={FIELD} required />
              <ul className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-[11px]">
                {([["10+ characters", rules.length], ["a number", rules.number], ["upper and lowercase", rules.upperLower]] as const).map(([label, ok]) => (
                  <li key={label} className={ok ? "text-emerald-400" : "text-slate-500"}>{ok ? "✓" : "•"} {label}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300" htmlFor="confirm-password">Confirm new password</label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} required />
              {confirm && next !== confirm && <div className="text-[10px] text-rose-400">Passwords do not match</div>}
            </div>
            {pwNote && <p role="status" className={`text-xs ${pwNote.ok ? "text-emerald-400" : "text-rose-400"}`}>{pwNote.text}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={pwBusy || !current || !strong || next !== confirm} className={SAVE}>
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
              </Button>
              {options?.password_reset && (
                <button type="button" onClick={() => setSettingPassword((v) => !v)} className="text-xs text-amber-400 hover:text-amber-300">
                  Forgot your current password?
                </button>
              )}
            </div>
            {settingPassword && options?.password_reset && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <PasswordResetForm
                  initialEmail={user.email}
                  emailLocked
                  doneLabel="Sign in again"
                  onDone={() => { logout(); navigate("/login", { replace: true }) }}
                />
              </div>
            )}
          </form>
        ) : options?.password_reset ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-400">
              This account signs in with {user.google_linked ? "Google" : "an emailed code"} and has no password. You can add one: we email a code to{" "}
              <span className="font-semibold text-slate-200">{user.email}</span> to confirm it is you.
            </p>
            <PasswordResetForm
              initialEmail={user.email}
              emailLocked
              doneLabel="Sign in again"
              onDone={() => { logout(); navigate("/login", { replace: true }) }}
            />
          </div>
        ) : (
          <p className="flex items-start gap-2 text-xs text-slate-400">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            Setting a password needs a code by email, and this server cannot send email.
          </p>
        )}
      </Section>

      <Section title="Sessions" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          If you used a shared computer or suspect someone else has your session, sign out everywhere else. This browser stays signed in. Changing
          your password does the same.
        </p>
        {sessionNote && <p role="status" className={`mb-2 text-xs ${sessionNote.ok ? "text-emerald-400" : "text-rose-400"}`}>{sessionNote.text}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={signOutElsewhere} disabled={sessionBusy} className={SAVE}>
            {sessionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out of other devices"}
          </Button>
          <Button type="button" onClick={() => { logout(); navigate("/login", { replace: true }) }} className="h-9 border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10">
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out here
          </Button>
        </div>
      </Section>
    </motion.div>
  )
}
