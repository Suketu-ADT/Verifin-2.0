import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, DetailRow, Section } from "@/components/ui/card"
import { Field, Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { PageHeading } from "@/components/shared/PageHeading"
import { Notice } from "@/components/shared/states"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import { PasswordResetForm } from "../components/PasswordResetForm"
import { useAuth } from "../lib/AuthContext"
import { changePasswordRequest, errorMessage, fetchAuthOptions, revokeOtherSessions, updateProfile, type AuthOptions } from "../lib/api"

const when = (value?: string | null) => (value ? formatDateTime(value) : "Unavailable")

export default function Account() {
  const { user, authDisabled, applySession, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [options, setOptions] = useState<AuthOptions | null>(null)
  useEffect(() => {
    fetchAuthOptions().then(setOptions).catch(() => setOptions(null))
  }, [])

  // profile
  const [name, setName] = useState(user?.name ?? "")
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // change password
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  // set a password (accounts made with Google or an emailed code), sessions
  const [settingPassword, setSettingPassword] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)

  if (!user) return null

  if (authDisabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading title="My account" />
        <Notice tone="info" title="Accounts are switched off">Accounts are switched off on this server (local development), so there is no account to manage.</Notice>
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
    setNameError(null)
    try {
      updateUser(await updateProfile(trimmed))
      toast({ title: "Name updated", tone: "success" })
    } catch (err) {
      setNameError(errorMessage(err, "Could not update the name."))
    } finally {
      setNameBusy(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || !strong || next !== confirm || pwBusy) return
    setPwBusy(true)
    setPwError(null)
    try {
      applySession(await changePasswordRequest(current, next))
      setCurrent("")
      setNext("")
      setConfirm("")
      toast({ title: "Password changed", description: "Every other session was signed out.", tone: "success" })
    } catch (err) {
      setPwError(errorMessage(err, "Could not change the password."))
    } finally {
      setPwBusy(false)
    }
  }

  const signOutElsewhere = async () => {
    if (sessionBusy) return
    setSessionBusy(true)
    try {
      applySession(await revokeOtherSessions())
      toast({ title: "Signed out everywhere else", description: "This browser stays signed in.", tone: "success" })
    } catch (err) {
      toast({ title: "Could not sign out the other sessions", description: errorMessage(err, "Please try again."), tone: "error" })
    } finally {
      setSessionBusy(false)
    }
  }

  const hasPassword = user.has_password !== false
  const resetDone = () => { logout(); navigate("/login", { replace: true }) }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="My account" subtitle="Your profile, how you sign in, and where you are signed in." />

      <div className="divide-y divide-line">
        <Section title="Profile" description="Your name appears on the review decisions and reports you create.">
          <form onSubmit={saveName} className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Name" htmlFor="account-name" error={nameError} className="min-w-56 flex-1">
              <Input id="account-name" value={name} onChange={(e) => { setName(e.target.value); setNameError(null) }} maxLength={120} aria-invalid={!!nameError} />
            </Field>
            <Button type="submit" variant="primary" loading={nameBusy} disabled={!name.trim() || name.trim() === user.name}>Save</Button>
          </form>
          <DetailRow label="Email">
            <span className="inline-flex flex-wrap items-center justify-end gap-2 break-all">{user.email} {user.email_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}</span>
          </DetailRow>
          <DetailRow label="Role"><Badge tone="brand" className="capitalize">{user.role}</Badge></DetailRow>
          <DetailRow label="Organisation"><span className="font-mono text-xs">{user.tenant_id.slice(0, 8)}</span></DetailRow>
          <DetailRow label="Last sign-in">{when(user.last_login_at)}</DetailRow>
          <DetailRow label="Member since">{when(user.created_at)}</DetailRow>
        </Section>

        <Section title="How you sign in" description="The ways this account can be used to sign in.">
          <DetailRow label="Password">{hasPassword ? <Badge tone="success">Set</Badge> : <Badge tone="neutral">Not set</Badge>}</DetailRow>
          <DetailRow label="Google" hint={!user.google_linked && options?.google_client_id ? `Sign in with Google once, using ${user.email}, and it links itself.` : undefined}>
            {user.google_linked ? <Badge tone="success">Linked</Badge> : <Badge tone="neutral">Not linked</Badge>}
          </DetailRow>
          <DetailRow label="Emailed code">{options ? (options.email_otp ? <Badge tone="success">Available</Badge> : <Badge tone="neutral">Not available on this server</Badge>) : "Unavailable"}</DetailRow>
        </Section>

        <Section title={hasPassword ? "Change password" : "Set a password"} description="Changing your password signs you out of every other device.">
          {hasPassword ? (
            <form onSubmit={changePassword} className="space-y-4">
              <Field label="Current password" htmlFor="current-password">
                <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </Field>
              <Field label="New password" htmlFor="new-password">
                <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
                <ul className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs">
                  {([["10+ characters", rules.length], ["a number", rules.number], ["upper and lowercase", rules.upperLower]] as const).map(([label, ok]) => (
                    <li key={label} className={cn(ok ? "text-supported-fg" : "text-muted")}>{ok ? "✓" : "•"} {label}</li>
                  ))}
                </ul>
              </Field>
              <Field label="Confirm new password" htmlFor="confirm-password" error={confirm && next !== confirm ? "Passwords do not match" : undefined}>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!confirm && next !== confirm} required />
              </Field>
              {pwError && <Notice tone="error">{pwError}</Notice>}
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" variant="primary" loading={pwBusy} disabled={!current || !strong || next !== confirm}>Change password</Button>
                {options?.password_reset && (
                  <button type="button" onClick={() => setSettingPassword((v) => !v)} className="text-[13px] font-medium text-brand-2 hover:underline">Forgot your current password?</button>
                )}
              </div>
              {settingPassword && options?.password_reset && (
                <Card className="bg-canvas p-4 shadow-none">
                  <PasswordResetForm initialEmail={user.email} emailLocked doneLabel="Sign in again" onDone={resetDone} />
                </Card>
              )}
            </form>
          ) : options?.password_reset ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-muted">
                This account signs in with {user.google_linked ? "Google" : "an emailed code"} and has no password. You can add one: we email a code to{" "}
                <span className="font-medium text-ink">{user.email}</span> to confirm it is you.
              </p>
              <PasswordResetForm initialEmail={user.email} emailLocked doneLabel="Sign in again" onDone={resetDone} />
            </div>
          ) : (
            <p className="flex items-start gap-2 text-[13px] text-muted"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Setting a password needs a code by email, and this server cannot send email.</p>
          )}
        </Section>

        <Section title="Sessions" description="Where you are signed in.">
          <p className="mb-4 text-[13px] leading-relaxed text-muted">
            If you used a shared computer or suspect someone else has your session, sign out everywhere else. This browser stays signed in. Changing your password does the same.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={signOutElsewhere} loading={sessionBusy}>Sign out of other devices</Button>
            <Button variant="danger" onClick={resetDone}><LogOut /> Sign out here</Button>
          </div>
        </Section>
      </div>
    </div>
  )
}
