/** Wording for the deterministic figure check badge, so it never reads as a second verdict beside the claim's own. */
export function figureCheckLabel(outcome: string): string {
  if (outcome === "VALIDATED") return "passed"
  if (outcome === "MISMATCH") return "failed"
  return outcome.toLowerCase().replace(/_/g, " ")
}
