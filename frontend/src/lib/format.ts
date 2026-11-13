export const percent = (share: number, digits = 1) => `${(share * 100).toFixed(digits)}%`

/** 0 to 1 share as a whole percent, or null when the denominator is zero. */
export const share = (part: number, total: number) => (total > 0 ? part / total : null)

export function humanize(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, " ").trim().toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "None"
}

/** "Nov 13" from a calendar day ("2026-11-13") or a full timestamp. */
export function shortDate(iso: string): string {
  const dayOnly = iso.length <= 10
  const d = new Date(dayOnly ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleDateString(undefined, dayOnly ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric" })
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "–"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "–"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** "5 minutes ago" style, falling back to the date after a week. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "–"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "–"
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 8) return `${days} d ago`
  return formatDate(iso)
}

export function initials(nameOrEmail?: string | null): string {
  const base = (nameOrEmail ?? "").trim()
  if (!base) return "?"
  const parts = base.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase() || "?"
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
