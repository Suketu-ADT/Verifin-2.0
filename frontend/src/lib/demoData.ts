// Shared demo dataset used across Dashboard, History, Reports, and EvidenceExplorer.
//
// This mirrors the shape of the real backend response (see backend/app/schemas/schemas.py)
// and is grounded entirely in the one demo document VERIFIN ships with
// (data/demo/demo_data.json — an illustrative "Apple FY2025" excerpt). Nothing here
// implies real production usage, multiple customers, or verified real-world accuracy.
// It exists so every page shows the same, honestly-labeled example data instead of
// each page inventing its own fictional companies and metrics.

export type NLILabel = "SUPPORTED" | "CONTRADICTED" | "UNVERIFIABLE"

export interface Evidence {
  text: string
  page_number: number
  similarity_score: number
}

export interface NLI {
  entailment: number
  contradiction: number
  neutral: number
  label: NLILabel
}

export interface DemoClaim {
  id: string
  claim_text: string
  claim_type: string
  status: "Verified" | "Unverified"
  confidence: number
  risk_level: "LOW" | "MEDIUM" | "HIGH"
  source_sentence: string
  evidence: Evidence | null
  nli: NLI | null
}

export interface DemoSession {
  id: string
  title: string
  document: string
  llm_output: string
  ran_at: string
  claims: DemoClaim[]
}

const claim = (
  id: string,
  claim_text: string,
  claim_type: string,
  nli: NLI,
  evidence: Evidence | null,
  risk_level: DemoClaim["risk_level"],
): DemoClaim => ({
  id,
  claim_text,
  claim_type,
  status: nli.label === "UNVERIFIABLE" ? "Unverified" : "Verified",
  confidence: nli.label === "SUPPORTED" ? nli.entailment : nli.label === "CONTRADICTED" ? nli.contradiction : nli.neutral,
  risk_level,
  source_sentence: claim_text,
  evidence,
  nli,
})

export const demoSessions: DemoSession[] = [
  {
    id: "demo-1",
    title: "Revenue growth summary",
    document: "Apple_Annual_Report_2025.pdf",
    llm_output:
      "Apple's revenue increased by 12% in fiscal year 2025. The company generated $391 billion in annual revenue, and operating margin nearly doubled year-over-year.",
    ran_at: "2026-09-12T10:04:00Z",
    claims: [
      claim(
        "c1",
        "Apple's revenue increased by 12% in fiscal year 2025.",
        "Financial Metric",
        { entailment: 0.96, contradiction: 0.02, neutral: 0.02, label: "SUPPORTED" },
        { text: "Revenue increased by 12% in fiscal year 2025, driven by strong demand.", page_number: 43, similarity_score: 0.94 },
        "LOW",
      ),
      claim(
        "c2",
        "The company generated $391 billion in annual revenue.",
        "Financial Metric",
        { entailment: 0.98, contradiction: 0.01, neutral: 0.01, label: "SUPPORTED" },
        { text: "The company generated $391 billion in annual revenue.", page_number: 43, similarity_score: 0.99 },
        "LOW",
      ),
      claim(
        "c3",
        "Operating margin nearly doubled year-over-year.",
        "Financial Metric",
        { entailment: 0.04, contradiction: 0.9, neutral: 0.06, label: "CONTRADICTED" },
        { text: "Operating margin improved slightly compared to the prior fiscal year.", page_number: 45, similarity_score: 0.81 },
        "HIGH",
      ),
    ],
  },
  {
    id: "demo-2",
    title: "iPhone performance summary",
    document: "Apple_Annual_Report_2025.pdf",
    llm_output:
      "iPhone revenue increased significantly due to strong demand. iPhone demand remained strong throughout the year. iPhone Pro Max sales exceeded 40% of total iPhone unit volume.",
    ran_at: "2026-09-14T15:41:00Z",
    claims: [
      claim(
        "c4",
        "iPhone revenue increased significantly due to strong demand.",
        "Business Event",
        { entailment: 0.15, contradiction: 0.82, neutral: 0.03, label: "CONTRADICTED" },
        { text: "iPhone demand remained strong throughout the year. Operating margin improved slightly...", page_number: 45, similarity_score: 0.85 },
        "HIGH",
      ),
      claim(
        "c5",
        "iPhone demand remained strong throughout the year.",
        "Business Event",
        { entailment: 0.95, contradiction: 0.02, neutral: 0.03, label: "SUPPORTED" },
        { text: "iPhone demand remained strong throughout the year.", page_number: 45, similarity_score: 0.98 },
        "LOW",
      ),
      claim(
        "c6",
        "iPhone Pro Max sales exceeded 40% of total iPhone unit volume.",
        "Financial Metric",
        { entailment: 0.06, contradiction: 0.06, neutral: 0.88, label: "UNVERIFIABLE" },
        null,
        "MEDIUM",
      ),
    ],
  },
  {
    id: "demo-3",
    title: "Margin & outlook summary",
    document: "Apple_Annual_Report_2025.pdf",
    llm_output:
      "Operating margin improved slightly compared to the prior fiscal year. The company's operating margin declined this year. Revenue will double next year.",
    ran_at: "2026-09-17T09:12:00Z",
    claims: [
      claim(
        "c7",
        "Operating margin improved slightly compared to the prior fiscal year.",
        "Financial Metric",
        { entailment: 0.97, contradiction: 0.01, neutral: 0.02, label: "SUPPORTED" },
        { text: "Operating margin improved slightly compared to the prior fiscal year.", page_number: 45, similarity_score: 0.99 },
        "LOW",
      ),
      claim(
        "c8",
        "The company's operating margin declined this year.",
        "Financial Metric",
        { entailment: 0.03, contradiction: 0.94, neutral: 0.03, label: "CONTRADICTED" },
        { text: "Operating margin improved slightly compared to the prior fiscal year.", page_number: 45, similarity_score: 0.9 },
        "HIGH",
      ),
      claim(
        "c9",
        "Revenue will double next year.",
        "Future Projection",
        { entailment: 0.05, contradiction: 0.05, neutral: 0.9, label: "UNVERIFIABLE" },
        { text: "No evidence.", page_number: 0, similarity_score: 0.12 },
        "MEDIUM",
      ),
    ],
  },
]

export const allDemoClaims: DemoClaim[] = demoSessions.flatMap((s) => s.claims)

export function claimCounts(claims: DemoClaim[] = allDemoClaims) {
  const supported = claims.filter((c) => c.nli?.label === "SUPPORTED").length
  const contradicted = claims.filter((c) => c.nli?.label === "CONTRADICTED").length
  const unverifiable = claims.filter((c) => c.nli?.label === "UNVERIFIABLE").length
  return { total: claims.length, supported, contradicted, unverifiable }
}
