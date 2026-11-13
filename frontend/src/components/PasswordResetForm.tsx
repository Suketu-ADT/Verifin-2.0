import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { confirmPasswordReset, errorMessage, requestPasswordReset } from "../lib/api"

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
        <CheckCircle2 className="mx-auto size-10 text-supported" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-ink">Password updated</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Every other session was signed out. Use your new password from now on.</p>
        </div>
        <Button type="button" variant="primary" size="lg" onClick={onDone} className="w-full">{doneLabel}</Button>
      </div>
    )
  }

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-4">
        <Field label="Email address" htmlFor="reset-email">
          <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" readOnly={emailLocked} required autoComplete="email" />
        </Field>
        <p className="text-[13px] leading-relaxed text-muted">We will email a 6-digit code to this address. Entering it lets you choose a new password.</p>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Email me a code</Button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="block w-full text-center text-[13px] text-muted hover:text-ink">{cancelLabel}</button>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={confirmReset} className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted">
        If <span className="font-medium text-ink">{email.trim()}</span> has an account, a code is on its way. It expires in 10 minutes.
      </p>
      <Field label="6-digit code" htmlFor="reset-code">
        <Input
          id="reset-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="h-11 text-center font-mono text-lg tracking-[0.4em]"
          autoFocus
          required
        />
      </Field>
      <Field label="New password" htmlFor="reset-password">
        <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        <ul className="space-y-0.5 pt-1 text-xs">
          {([["At least 10 characters", rules.length], ["Contains a number", rules.number], ["Upper and lowercase letters", rules.upperLower]] as const).map(([label, ok]) => (
            <li key={label} className={cn(ok ? "text-supported-fg" : "text-muted")}>{ok ? "✓" : "•"} {label}</li>
          ))}
        </ul>
      </Field>
      <Field label="Confirm new password" htmlFor="reset-confirm" error={confirm && !matches ? "Passwords do not match" : undefined}>
        <Input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={!!confirm && !matches} required />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={code.length < 6 || !strong || !matches} className="w-full">Change password</Button>
      <div className="flex justify-between text-[13px]">
        {emailLocked ? <span /> : (
          <button type="button" onClick={() => { setSent(false); setError(null) }} className="text-muted hover:text-ink">Use a different email</button>
        )}
        <button type="button" onClick={() => void send()} disabled={wait > 0 || busy} className="font-medium text-brand-2 hover:underline disabled:text-faint disabled:no-underline">
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
