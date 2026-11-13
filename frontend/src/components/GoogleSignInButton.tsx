import { useEffect, useRef, useState } from "react"

const SCRIPT_SRC = "https://accounts.google.com/gsi/client"

interface GoogleId {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: string }) => void
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void
}

function googleId(): GoogleId | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id
}

let scriptPromise: Promise<void> | null = null

/** Load Google's sign-in script once; resolves when it is ready, rejects if it cannot be fetched (blocked, offline). */
function loadScript(): Promise<void> {
  if (googleId()) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script")
    tag.src = SCRIPT_SRC
    tag.async = true
    tag.onload = () => resolve()
    tag.onerror = () => {
      scriptPromise = null
      reject(new Error("Google sign-in could not be loaded."))
    }
    document.head.appendChild(tag)
  })
  return scriptPromise
}

interface Props {
  clientId: string
  /** Called with the ID token Google issued; the server verifies it. */
  onCredential: (credential: string) => void
}

/** Google's multicolour "G" (brand guidelines require the colours; the rest of the button is ours). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.88.92 7.55 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * "Continue with Google", drawn in the site's own style. Google's sign-in runs inside an iframe whose look cannot be changed,
 * so the real Google button is laid over ours, invisible but still receiving the click; Google still performs the sign-in
 * and the server still verifies the token it returns.
 */
export function GoogleSignInButton({ clientId, onCredential }: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const callback = useRef(onCredential)
  useEffect(() => {
    callback.current = onCredential
  })

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        const id = googleId()
        if (cancelled || !id || !holder.current) return
        id.initialize({
          client_id: clientId,
          callback: (response) => response.credential && callback.current(response.credential),
        })
        const width = Math.min(400, Math.max(200, Math.round(wrapper.current?.offsetWidth ?? 320)))
        id.renderButton(holder.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (failed) return <p className="text-center text-xs text-slate-500">Google sign-in is unavailable right now.</p>
  return (
    <div
      ref={wrapper}
      className="group relative h-11 w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-sm transition-colors hover:border-amber-500/40 hover:bg-white/[0.07] focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/30"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 text-sm font-semibold text-slate-200 group-hover:text-white">
        <GoogleG />
        Continue with Google
      </div>
      <div ref={holder} className="absolute inset-0 flex scale-y-[1.12] items-center justify-center overflow-hidden opacity-[0.01]" aria-label="Continue with Google" />
    </div>
  )
}
