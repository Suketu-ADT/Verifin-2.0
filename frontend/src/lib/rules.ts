/**
 * Plain-language explanation of each verdict-policy rule (`decided_by`). The rules run in a fixed priority order, so every verdict
 * can be traced to exactly one of them. The wording follows backend/app/services/verdict_policy.py.
 */
export interface RuleInfo {
  label: string
  summary: string
  /** Position in the priority order (1 runs first). */
  priority: number
}

export const RULES: Record<string, RuleInfo> = {
  entity_novelty: {
    label: "Unknown names",
    summary: "The claim names people, companies or products that appear nowhere in the document, so it cannot be verified.",
    priority: 1,
  },
  figure_conflict: {
    label: "Figure conflict",
    summary: "The evidence states a different figure for the same fact the claim reports.",
    priority: 2,
  },
  table_mismatch: {
    label: "Table arithmetic",
    summary: "A figure was recomputed from the document's tables, or from evidence figures for derived values such as growth or margin, and it did not match the claim.",
    priority: 3,
  },
  temporal: {
    label: "Reporting period",
    summary: "The period the claim refers to differs from the period of the evidence.",
    priority: 4,
  },
  multi_hop: {
    label: "Multi-step calculation",
    summary: "A value derived from figures on several pages conflicts with the claim.",
    priority: 5,
  },
  nli: {
    label: "Language inference",
    summary: "A natural-language-inference model compared the claim with the retrieved evidence, and its outcome decided the verdict.",
    priority: 6,
  },
  grounded_support: {
    label: "Grounded figures",
    summary: "The inference model was inconclusive, but every figure in the claim appears in the evidence and the closest evidence sentence shares enough wording with the claim.",
    priority: 7,
  },
}

export function ruleInfo(rule?: string | null): RuleInfo | null {
  if (!rule) return null
  return RULES[rule] ?? { label: rule.replace(/[_-]+/g, " "), summary: "A verdict-policy rule decided this claim.", priority: 99 }
}

/** What the confidence number means, since it differs by rule. */
export function confidenceNote(rule?: string | null): string {
  if (rule === "nli") return "Confidence is the language model's probability for its verdict. It is a model score, not a guarantee."
  return "For a verdict decided by a rule, confidence is an evidence-alignment score, not a calibrated probability."
}
