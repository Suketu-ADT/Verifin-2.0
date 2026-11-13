import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, FileSearch, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { VERDICT_ORDER, VERDICTS } from "@/lib/verdict"
import { useAuth } from "../lib/AuthContext"
import { errorMessage, fetchAuthOptions, requestOtp, type AuthOptions } from "../lib/api"
import { EmailCodeForm } from "../components/EmailCodeForm"
import { GoogleSignInButton } from "../components/GoogleSignInButton"
import { PasswordResetForm } from "../components/PasswordResetForm"

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine initial state based on route, but allow toggling without navigating
  const [isLogin, setIsLogin] = useState(location.pathname === "/login")

  // Sync state if route actually changes from outside
  useEffect(() => {
    setIsLogin(location.pathname === "/login")
  }, [location.pathname])

  // Login fields
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Signup fields
  const [signupName, setSignupName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [signupCode, setSignupCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [resendWait, setResendWait] = useState(0)
  const [showSignupPassword, setShowSignupPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, register, loginWithGoogle, user } = useAuth()
  const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard"

  // which sign-in methods the server offers; until it answers, only the password form shows
  const [options, setOptions] = useState<AuthOptions | null>(null)
  const [loginMethod, setLoginMethod] = useState<"password" | "code">("password")
  const [resetMode, setResetMode] = useState(false)
  useEffect(() => {
    fetchAuthOptions().then(setOptions).catch(() => setOptions(null))
  }, [])

  const [googleError, setGoogleError] = useState<string | null>(null)
  const handleGoogle = async (credential: string) => {
    setGoogleError(null)
    try {
      await loginWithGoogle(credential)
      navigate(destination, { replace: true })
    } catch (err) {
      setGoogleError(errorMessage(err, "Could not sign in with Google. Try again."))
    }
  }

  const googleBlock = options?.google_client_id ? (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleSignInButton clientId={options.google_client_id} onCredential={handleGoogle} />
      {googleError && <p role="alert" className="mt-3 text-center text-xs text-contradicted-fg">{googleError}</p>}
    </div>
  ) : null

  // already signed in: nothing to do here
  useEffect(() => {
    if (user) navigate(destination, { replace: true })
  }, [user, destination, navigate])

  const rules = {
    length: signupPassword.length >= 10,
    number: /\d/.test(signupPassword),
    upperLower: /[a-z]/.test(signupPassword) && /[A-Z]/.test(signupPassword),
  }
  const allRulesPassed = rules.length && rules.number && rules.upperLower

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) return
    setIsLoading(true)
    setError(null)
    try {
      await login(loginEmail.trim(), loginPassword)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(errorMessage(err, "Could not sign in. Check your connection and try again."))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (resendWait <= 0) return
    const timer = setTimeout(() => setResendWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendWait])

  const resendSignupCode = async () => {
    if (resendWait > 0 || isLoading) return
    setError(null)
    try {
      const sent = await requestOtp(signupEmail.trim())
      setSignupCode("")
      setResendWait(sent.resend_after_seconds)
    } catch (err) {
      setError(errorMessage(err, "Could not send a code. Check your connection and try again."))
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm || !allRulesPassed || signupPassword !== signupConfirm) return
    setIsLoading(true)
    setError(null)
    try {
      if (options?.registration_needs_code && !codeSent) {
        const sent = await requestOtp(signupEmail.trim())
        setCodeSent(true)
        setSignupCode("")
        setResendWait(sent.resend_after_seconds)
        return
      }
      await register(signupEmail.trim(), signupPassword, signupName.trim(), signupCode)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(errorMessage(err, "Could not create the account. Check your connection and try again."))
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = (mode: "login" | "signup") => {
    setIsLogin(mode === "login")
    setError(null)
    // update the URL without a full reload
    window.history.pushState(null, "", `${((import.meta as any).env?.BASE_URL as string | undefined)?.replace(/\/$/, "") ?? ""}/${mode}`)
  }

  const heading = (title: string, sub: string) => (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-muted">{sub}</p>
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Form column */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="size-3.5" aria-hidden="true" /> Back to home</Link>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[0.04em] text-brand">
              <span className="grid size-7 place-items-center rounded-md bg-brand text-white"><ShieldCheck className="size-4" aria-hidden="true" /></span>
              VERIFIN
            </span>
          </div>

          <div role="tablist" aria-label="Sign in or sign up" className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-line bg-subtle p-1">
            {([["login", "Sign in"], ["signup", "Sign up"]] as const).map(([mode, label]) => {
              const on = (mode === "login") === isLogin
              return (
                <button key={mode} type="button" role="tab" aria-selected={on} onClick={() => toggleMode(mode)}
                  className={cn("rounded-md py-2 text-sm font-medium transition-[background-color,color,box-shadow]", on ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink")}>
                  {label}
                </button>
              )
            })}
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            {isLogin ? (
              resetMode ? (
                <>
                  {heading("Reset your password", "We will email you a code, then you choose a new password.")}
                  <PasswordResetForm
                    initialEmail={loginEmail}
                    onCancel={() => setResetMode(false)}
                    onDone={() => { setResetMode(false); setLoginMethod("password"); setLoginPassword(""); setError(null) }}
                  />
                </>
              ) : (
                <>
                  {heading("Welcome back", "Sign in to your organisation's workspace.")}

                  {options?.email_otp && (
                    <div className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-line bg-subtle p-0.5 text-[13px] font-medium" role="tablist" aria-label="Sign-in method">
                      {(["password", "code"] as const).map((m) => (
                        <button key={m} type="button" role="tab" aria-selected={loginMethod === m} onClick={() => { setLoginMethod(m); setError(null) }}
                          className={cn("rounded-[5px] py-1.5 transition-colors", loginMethod === m ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink")}>
                          {m === "password" ? "Password" : "Email code"}
                        </button>
                      ))}
                    </div>
                  )}

                  {loginMethod === "code" && options?.email_otp ? (
                    <EmailCodeForm onDone={() => navigate(destination, { replace: true })} />
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <Field label="Email address" htmlFor="login-email">
                        <Input id="login-email" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" className="h-11" required />
                      </Field>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="login-password" className="block text-[13px] font-medium text-ink">Password</label>
                          {options?.password_reset && (
                            <button type="button" onClick={() => { setResetMode(true); setError(null) }} className="text-[13px] font-medium text-brand-2 hover:underline">Forgot password?</button>
                          )}
                        </div>
                        <Input id="login-password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className="h-11" required />
                      </div>
                      {error && <Notice tone="error">{error}</Notice>}
                      <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">Sign in</Button>
                    </form>
                  )}
                  {googleBlock}
                </>
              )
            ) : (
              <>
                {heading("Create account", "Creates a new organisation with you as its administrator.")}
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <Field label="Full name" htmlFor="signup-name">
                    <Input id="signup-name" autoComplete="name" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Jane Doe" className="h-11" required />
                  </Field>
                  <Field label="Email address" htmlFor="signup-email">
                    <Input id="signup-email" type="email" autoComplete="email" value={signupEmail} onChange={(e) => { setSignupEmail(e.target.value); setCodeSent(false); setSignupCode("") }} placeholder="you@example.com" className="h-11" required />
                  </Field>
                  <Field label="Password" htmlFor="signup-password">
                    <div className="relative">
                      <Input id="signup-password" type={showSignupPassword ? "text" : "password"} autoComplete="new-password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="••••••••" className="h-11 pr-11" required />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} aria-label={showSignupPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink">
                        {showSignupPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <ul className="space-y-0.5 pt-1.5 text-xs" aria-label="Password requirements">
                      {([["At least 10 characters", rules.length], ["Contains a number", rules.number], ["Upper and lowercase letters", rules.upperLower]] as const).map(([label, ok]) => (
                        <li key={label} className={cn(ok ? "text-supported-fg" : "text-muted")}>{ok ? "✓" : "•"} {label}</li>
                      ))}
                    </ul>
                  </Field>
                  <Field label="Confirm password" htmlFor="signup-confirm" error={signupConfirm && signupPassword !== signupConfirm ? "Passwords do not match" : undefined}>
                    <Input id="signup-confirm" type="password" autoComplete="new-password" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} placeholder="••••••••" className="h-11" aria-invalid={!!signupConfirm && signupPassword !== signupConfirm} required />
                  </Field>

                  {codeSent && (
                    <div className="space-y-1.5 rounded-lg border border-line bg-canvas p-3.5">
                      <label htmlFor="signup-code" className="block text-[13px] font-medium text-ink">6-digit code sent to {signupEmail.trim()}</label>
                      <Input id="signup-code" value={signupCode} onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="h-11 text-center font-mono text-lg tracking-[0.4em]" autoFocus required />
                      <div className="flex justify-between pt-1 text-xs">
                        <span className="text-muted">Expires in 10 minutes</span>
                        <button type="button" onClick={resendSignupCode} disabled={resendWait > 0 || isLoading} className="font-medium text-brand-2 hover:underline disabled:text-faint disabled:no-underline">
                          {resendWait > 0 ? `Resend in ${resendWait}s` : "Resend code"}
                        </button>
                      </div>
                    </div>
                  )}

                  {error && <Notice tone="error">{error}</Notice>}
                  <Button type="submit" variant="primary" size="lg" loading={isLoading} disabled={!allRulesPassed || (signupPassword !== signupConfirm && signupConfirm.length > 0) || (codeSent && signupCode.length < 6)} className="w-full">
                    {options?.registration_needs_code && !codeSent ? "Email me a verification code" : "Create account"}
                  </Button>
                </form>
                {googleBlock}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Brand column: explains the verdicts, with no sample numbers */}
      <aside className="on-navy hidden flex-1 flex-col justify-center bg-navy px-12 py-12 text-white lg:flex" aria-label="About VERIFIN">
        <div className="mx-auto w-full max-w-md">
          <FileSearch className="mb-6 size-8 text-sky" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Trust through transparency.<br />Intelligence through evidence.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            VERIFIN checks every claim in an AI-written financial answer against the source document, and shows the evidence and the rule behind each verdict. Never a bare score.
          </p>
          <ul className="mt-8 space-y-3">
            {VERDICT_ORDER.map((k) => {
              const v = VERDICTS[k]
              return (
                <li key={k} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3.5">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white" style={{ color: v.color }}><v.Icon className="size-4" aria-hidden="true" /></span>
                  <div>
                    <div className="text-[13px] font-semibold">{v.label}</div>
                    <div className="text-xs leading-relaxed text-white/65">{v.meaning}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
