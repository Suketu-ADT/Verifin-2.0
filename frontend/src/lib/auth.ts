// Access-token storage. sessionStorage keeps the token for the tab only, so closing the browser signs the user out;
// it is never written to a URL or logged.
const KEY = "verifin_token"

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    /* storage unavailable (private mode): the session lasts until reload */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  tenant_id: string
  role: "viewer" | "analyst" | "admin"
  is_active: boolean
  created_at: string
  email_verified?: boolean
  /** false for accounts made with Google or an emailed code that never set a password */
  has_password?: boolean
  google_linked?: boolean
  last_login_at?: string | null
}

/** The backend answers as this user when authentication is switched off (local development). */
export const ANONYMOUS_ID = "anonymous"

const RANK = { viewer: 1, analyst: 2, admin: 3 } as const

export function hasRole(user: AuthUser | null, minimum: keyof typeof RANK): boolean {
  return !!user && RANK[user.role] >= RANK[minimum]
}
