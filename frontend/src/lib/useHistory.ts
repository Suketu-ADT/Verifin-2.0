import { useCallback, useEffect, useState } from "react"
import { errorMessage, listVerifications, type VerificationSummary } from "./api"

/** The organisation's recent verifications, loaded from the API. */
export function useHistory(limit = 100) {
  const [sessions, setSessions] = useState<VerificationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSessions(await listVerifications(limit))
    } catch (err) {
      setError(errorMessage(err, "Could not load the verification history."))
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void reload()
  }, [reload])

  return { sessions, loading, error, reload }
}

export const countOf = (s: VerificationSummary, verdict: "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED") =>
  s.claim_counts[verdict] ?? 0

export const totalClaims = (s: VerificationSummary) =>
  Object.values(s.claim_counts).reduce((a, b) => a + b, 0)

/** A finished run with no contradicted claim and no high risk. */
export const isClean = (s: VerificationSummary) => s.status === "completed" && countOf(s, "CONTRADICTED") === 0 && s.risk_level !== "HIGH"
