import { AlertTriangle, CheckCircle2, HelpCircle, Shield, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react"

/**
 * The one place that decides how a verdict or risk level looks. Badges, charts, tables and cards all read from here, so the three
 * meanings never drift apart: supported = green, contradicted = red, unverifiable = amber.
 */

export type Verdict = "SUPPORTED" | "CONTRADICTED" | "UNVERIFIABLE"

export interface VerdictMeta {
  key: Verdict
  /** The key the backend uses in claim_counts and analytics. */
  backendKey: "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED"
  label: string
  /** One sentence on what the verdict means, shown in legends and help text. */
  meaning: string
  Icon: LucideIcon
  /** Base colour for chart marks, fills and icons. */
  color: string
  /** Text colour class that passes contrast on the tint. */
  text: string
  /** Full chip classes: tinted background, border and text. */
  chip: string
  tint: string
  border: string
  /** Solid bar fill class. */
  bar: string
  /** Extra texture class so a verdict is not told apart by colour alone inside bars. */
  texture: string
}

export const VERDICTS: Record<Verdict, VerdictMeta> = {
  SUPPORTED: {
    key: "SUPPORTED",
    backendKey: "SUPPORTED",
    label: "Supported",
    meaning: "The source document backs the claim.",
    Icon: CheckCircle2,
    color: "#16a34a",
    text: "text-supported-fg",
    chip: "bg-supported-tint text-supported-fg border-supported-line",
    tint: "bg-supported-tint",
    border: "border-supported-line",
    bar: "bg-supported",
    texture: "",
  },
  CONTRADICTED: {
    key: "CONTRADICTED",
    backendKey: "CONTRADICTED",
    label: "Contradicted",
    meaning: "The source document says something different from the claim.",
    Icon: AlertTriangle,
    color: "#dc2626",
    text: "text-contradicted-fg",
    chip: "bg-contradicted-tint text-contradicted-fg border-contradicted-line",
    tint: "bg-contradicted-tint",
    border: "border-contradicted-line",
    bar: "bg-contradicted",
    texture: "tex-contradicted",
  },
  UNVERIFIABLE: {
    key: "UNVERIFIABLE",
    backendKey: "UNVERIFIED",
    label: "Unverifiable",
    meaning: "The document holds no evidence that settles the claim either way.",
    Icon: HelpCircle,
    color: "#d97706",
    text: "text-unverifiable-fg",
    chip: "bg-unverifiable-tint text-unverifiable-fg border-unverifiable-line",
    tint: "bg-unverifiable-tint",
    border: "border-unverifiable-line",
    bar: "bg-unverifiable",
    texture: "tex-unverifiable",
  },
}

export const VERDICT_ORDER: Verdict[] = ["SUPPORTED", "CONTRADICTED", "UNVERIFIABLE"]

/** Maps any status string the API or the NLI model uses onto one of the three verdicts. */
export function normalizeVerdict(raw?: string | null): Verdict {
  const v = (raw ?? "").toUpperCase()
  if (v === "SUPPORTED" || v === "ENTAILMENT" || v === "VERIFIED") return "SUPPORTED"
  if (v === "CONTRADICTED" || v === "CONTRADICTION") return "CONTRADICTED"
  return "UNVERIFIABLE"
}

export const verdictMeta = (raw?: string | null): VerdictMeta => VERDICTS[normalizeVerdict(raw)]

// ── Risk ────────────────────────────────────────────────────────────────────────

export type Risk = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"

export interface RiskMeta {
  key: Risk
  label: string
  /** 0 to 3: how many segments of the meter are filled. */
  level: number
  Icon: LucideIcon
  color: string
  text: string
  meaning: string
}

export const RISKS: Record<Risk, RiskMeta> = {
  LOW: { key: "LOW", label: "Low risk", level: 1, Icon: ShieldCheck, color: "#8fa6c4", text: "text-ink", meaning: "No sign of a hallucination." },
  MEDIUM: { key: "MEDIUM", label: "Medium risk", level: 2, Icon: Shield, color: "#4d6d97", text: "text-ink", meaning: "Some claims could not be verified." },
  HIGH: { key: "HIGH", label: "High risk", level: 3, Icon: ShieldAlert, color: "#142b4a", text: "text-ink", meaning: "At least one claim contradicts the document." },
  UNKNOWN: { key: "UNKNOWN", label: "Risk unavailable", level: 0, Icon: Shield, color: "#cbd5e1", text: "text-muted", meaning: "No risk level was recorded." },
}

export function normalizeRisk(raw?: string | null): Risk {
  const r = (raw ?? "").toUpperCase()
  return r === "LOW" || r === "MEDIUM" || r === "HIGH" ? r : "UNKNOWN"
}

export const riskMeta = (raw?: string | null): RiskMeta => RISKS[normalizeRisk(raw)]
