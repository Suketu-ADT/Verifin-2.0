import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { confirmPasswordReset, errorMessage, requestPasswordReset } from "../lib/api"

const FIELD = "h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm"
const PRIMARY =
  "w-full h-11 text-sm font-bold mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-lg shadow-amber-500/20"

interface Props {
  /** Address to start with (the signed-in user's own, when setting a password from the account page). */
  initialEmail?: string
  /** The address cannot be edited: the account page may only reset the signed-in user's own password. */
  emailLocked?: boolean
  /** Called after the password was changed (the user then signs in with it). */
  onDone: () => void
  /** Shown as a "back" link on the first step. */
  onCancel?: () => void
  cancelLabel?: string
  doneLabel?: string
}

/** Forgot password / set a password: an emailed 6-digit code proves the address, then a new password is chosen. */
export function PasswordResetForm({ initialEmail = "", emailLocked = false, onDone, onCancel, cancelLabel = "Back to sign in", doneLabel = "Continue to sign in" }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [sent, setSent] = useState(false)
  const [finished, setFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const rules = {
    length: password.length >= 10,
    number: /\d/.test(password),
    upperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
  }
  const strong = rules.length && rules.number && rules.upperLower
  const matches = password === confirm

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email || busy || wait > 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await requestPasswordReset(email.trim())
      setSent(true)
      setCode("")
      setWait(result.resend_after_seconds)
    } catch (err) {
      setError(errorMessage(err, "Could not send a code. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6 || !strong || !matches || busy) return
    setBusy(true)
    setError(null)
    try {
      await confirmPasswordReset(email.trim(), code, password)
      setFinished(true)
    } catch (err) {
      setError(errorMessage(err, "Could not change the password. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  if (finished) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <div>
          <h2 className="text-lg font-bold text-white">Password updated</h2>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">Every other session was signed out. Use your new password from now on.</p>
        </div>
        <Button type="button" onClick={onDone} className={PRIMARY}>{doneLabel}</Button>
      </div>
    )
  }

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Email Address</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={FIELD} readOnly={emailLocked} required />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">We will email a 6-digit code to this address. Entering it lets you choose a new password.</p>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <Button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Email me a code"}
        </Button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="block w-full text-center text-xs text-slate-400 hover:text-white">
            {cancelLabel}
          </button>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={confirmReset} className="space-y-4">
      <p className="text-xs text-slate-300 leading-relaxed">
        If <span className="font-semibold text-white">{email.trim()}</span> has an account, a code is on its way. It expires in 10 minutes.
      </p>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300">6-digit code</label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className={`${FIELD} text-center text-lg tracking-[0.4em] font-mono`}
          autoFocus
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300">New password</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={FIELD} required />
        <ul className="space-y-0.5 pt-1 text-[11px]">
          {([["At least 10 characters", rules.length], ["Contains a number", rules.number], ["Upper and lowercase letters", rules.upperLower]] as const).map(([label, ok]) => (
            <li key={label} className={ok ? "text-emerald-400" : "text-slate-500"}>{ok ? "✓" : "•"} {label}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300">Confirm new password</label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={FIELD} required />
        {confirm && !matches && <div className="text-[10px] text-rose-400">Passwords do not match</div>}
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <Button type="submit" disabled={busy || code.length < 6 || !strong || !matches} className={PRIMARY}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Change password"}
      </Button>
      <div className="flex justify-between text-xs">
        {emailLocked ? <span /> : (
          <button type="button" onClick={() => { setSent(false); setError(null) }} className="text-slate-400 hover:text-white">
            Use a different email
          </button>
        )}
        <button type="button" onClick={() => send()} disabled={wait > 0 || busy} className="text-amber-400 hover:text-amber-300 disabled:text-slate-600">
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
