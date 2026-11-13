import { useEffect, useState } from "react"
import { getSystemHealth, type HealthResponse } from "./api"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const q = window.matchMedia(query)
    const on = () => setMatches(q.matches)
    on()
    q.addEventListener("change", on)
    return () => q.removeEventListener("change", on)
  }, [query])
  return matches
}

/** A value kept in localStorage, falling back to memory when storage is unavailable (private windows). */
type Widen<T> = T extends boolean ? boolean : string

export function useStoredState<I extends string | boolean>(key: string, initialValue: I): [Widen<I>, (v: Widen<I>) => void] {
  type T = Widen<I>
  const initial = initialValue as T
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      return (typeof initialValue === "boolean" ? raw === "true" : raw) as T
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, String(v))
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
  }
  return [value, set]
}

export type HealthState =
  | { state: "checking" }
  | { state: "ok"; health: HealthResponse }
  | { state: "degraded"; health: HealthResponse }
  | { state: "offline" }

/** Live engine health from /system/health, re-checked every minute. Never invents a status: until the first answer it says "checking". */
export function useSystemHealth(intervalMs = 60_000): HealthState {
  const [health, setHealth] = useState<HealthState>({ state: "checking" })
  useEffect(() => {
    let cancelled = false
    const check = () =>
      getSystemHealth()
        .then((h) => {
          if (cancelled) return
          setHealth({ state: h.status === "healthy" ? "ok" : "degraded", health: h })
        })
        .catch(() => !cancelled && setHealth({ state: "offline" }))
    void check()
    const t = window.setInterval(check, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [intervalMs])
  return health
}
