import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Notice } from "@/components/shared/states"
import { errorMessage, requestOtp } from "../lib/api"
import { useAuth } from "../lib/AuthContext"

/** Passwordless sign-in: ask for a code by email, then type it. Works for new addresses too when the server allows sign-up. */
export function EmailCodeForm({ onDone }: { onDone: () => void }) {
  const { loginWithCode } = useAuth()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email || busy || wait > 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await requestOtp(email.trim())
      setSent(true)
      setCode("")
      setWait(result.resend_after_seconds)
    } catch (err) {
      setError(errorMessage(err, "Could not send a code. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      await loginWithCode(email.trim(), code)
      onDone()
    } catch (err) {
      setError(errorMessage(err, "Could not verify the code. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-4">
        <Field label="Email address" htmlFor="otp-email">
          <Input id="otp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
        </Field>
        <p className="text-[13px] leading-relaxed text-muted">We will email you a 6-digit code. No password needed.</p>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Email me a code</Button>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted">
        If <span className="font-medium text-ink">{email.trim()}</span> can sign in, a code is on its way. It expires in 10 minutes.
      </p>
      <Field label="6-digit code" htmlFor="otp-code">
        <Input
          id="otp-code"
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
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={code.length < 6} className="w-full">Verify and sign in</Button>
      <div className="flex justify-between text-[13px]">
        <button type="button" onClick={() => { setSent(false); setError(null) }} className="text-muted hover:text-ink">Use a different email</button>
        <button type="button" onClick={() => void send()} disabled={wait > 0 || busy} className="font-medium text-brand-2 hover:underline disabled:text-faint disabled:no-underline">
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
