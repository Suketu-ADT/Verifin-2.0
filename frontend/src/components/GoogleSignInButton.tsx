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

/** Google's own "Continue with Google" button. Renders nothing visible until the script has loaded. */
export function GoogleSignInButton({ clientId, onCredential }: Props) {
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
        id.renderButton(holder.current, { type: "standard", theme: "filled_black", size: "large", text: "continue_with", shape: "pill", width: 320 })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (failed) return <p className="text-center text-xs text-slate-500">Google sign-in is unavailable right now.</p>
  return <div ref={holder} className="flex min-h-[44px] justify-center" aria-label="Continue with Google" />
}
