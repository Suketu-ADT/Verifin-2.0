import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { errorMessage, requestOtp } from "../lib/api"
import { useAuth } from "../lib/AuthContext"

const FIELD = "h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm"
const PRIMARY =
  "w-full h-11 text-sm font-bold mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-lg shadow-amber-500/20"

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
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Email Address</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={FIELD} required />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">We will email you a 6-digit code. No password needed.</p>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <Button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Email me a code"}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-xs text-slate-300 leading-relaxed">
        If <span className="font-semibold text-white">{email.trim()}</span> can sign in, a code is on its way. It expires in 10 minutes.
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
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <Button type="submit" disabled={busy || code.length < 6} className={PRIMARY}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Verify and sign in"}
      </Button>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={() => { setSent(false); setError(null) }} className="text-slate-400 hover:text-white">
          Use a different email
        </button>
        <button type="button" onClick={() => send()} disabled={wait > 0 || busy} className="text-amber-400 hover:text-amber-300 disabled:text-slate-600">
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
