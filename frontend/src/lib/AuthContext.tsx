import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { fetchCurrentUser, googleLoginRequest, loginRequest, registerRequest, verifyOtp, type TokenResponse } from "./api"
import { ANONYMOUS_ID, clearToken, setToken, type AuthUser } from "./auth"

interface AuthState {
  user: AuthUser | null
  loading: boolean
  /** true when the backend runs without authentication (local development) */
  authDisabled: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, code?: string) => Promise<void>
  /** Finish an emailed-code sign-in (the code was requested with requestOtp). */
  loginWithCode: (email: string, code: string, name?: string) => Promise<void>
  /** Sign in with the ID token Google Identity Services returned. */
  loginWithGoogle: (credential: string) => Promise<void>
  /** Adopt the fresh token and user an account action returned (the old token stopped working). */
  applySession: (result: TokenResponse) => void
  /** Replace the signed-in user's details after an edit. */
  updateUser: (user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchCurrentUser()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const register = useCallback(async (email: string, password: string, name: string, code?: string) => {
    const result = await registerRequest(email, password, name, code)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const loginWithCode = useCallback(async (email: string, code: string, name?: string) => {
    const result = await verifyOtp(email, code, name)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const result = await googleLoginRequest(credential)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const applySession = useCallback((result: TokenResponse) => {
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, authDisabled: user?.id === ANONYMOUS_ID, login, register, loginWithCode, loginWithGoogle, applySession, updateUser: setUser, logout }),
    [user, loading, login, register, loginWithCode, loginWithGoogle, applySession, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

/** Renders the nested routes only for a signed-in user; everyone else goes to the login page. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400" role="status">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Like RequireAuth, for pages only some roles may open. */
export function RequireRole({ minimum, children }: { minimum: "analyst" | "admin"; children: ReactNode }) {
  const { user } = useAuth()
  const allowed = user && (minimum === "analyst" ? user.role !== "viewer" : user.role === "admin")
  if (!allowed) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h2 className="text-lg font-semibold text-white">Not available for your role</h2>
        <p className="mt-2 text-sm text-slate-400">Ask an administrator of your organisation for access.</p>
      </div>
    )
  }
  return <>{children}</>
}
