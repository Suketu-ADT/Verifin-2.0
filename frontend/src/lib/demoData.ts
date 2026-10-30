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
  dense_score?: number | null
  bm25_score?: number | null
  retrieval_method?: string
  matched_keywords?: string[]
  bounding_box?: any
  is_ocr?: boolean
  extraction_method?: string
  ocr_confidence?: number | null
  needs_review?: boolean
  words?: any[] | null
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
  status: "Verified" | "Unverified" | string
  confidence: number
  risk_level: "LOW" | "MEDIUM" | "HIGH" | string
  source_sentence: string
  evidence: Evidence | null
  nli: NLI | null
  numerical_finding?: any
  temporal_anchor?: any
  hallucination_type?: string | null
  hallucination_risk_score?: number | null
  reasoning_summary?: string | null
  multi_hop_finding?: any
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
  extra?: Partial<DemoClaim>
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
  ...extra,
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
        {
          text: "Revenue increased by 12% in fiscal year 2025, driven by strong demand across Services and iPhone hardware sales.",
          page_number: 43,
          similarity_score: 0.94,
          dense_score: 0.91,
          bm25_score: 14.85,
          retrieval_method: "hybrid",
          matched_keywords: ["revenue", "increased", "12%", "fiscal", "year", "2025"],
        },
        "LOW",
        {
          hallucination_type: "NONE",
          hallucination_risk_score: 0.04,
          reasoning_summary: "Entailment confirmed by DeBERTa-v3 cross-encoder (96.0%) and matched against Page 43 consolidated statements with fiscal year 2025 alignment.",
          numerical_finding: {
            comparison_outcome: "VALIDATED",
            formula: "12% YoY Revenue Growth",
            computed_result: 12.0,
            reported_result: 12.0,
            tolerance: 0.5,
            explanation: "Reported revenue growth of 12% exactly matches SEC 10-K reported figures for fiscal year 2025.",
          },
          temporal_anchor: {
            period_match: "ALIGNED",
            claim_period: "FY2025",
            evidence_period: "FY2025",
            document_period: "FY2025",
            explanation: "Both claim and retrieved passage explicitly cover fiscal year 2025.",
          },
        }
      ),
      claim(
        "c2",
        "The company generated $391 billion in annual revenue.",
        "Financial Metric",
        { entailment: 0.98, contradiction: 0.01, neutral: 0.01, label: "SUPPORTED" },
        {
          text: "The company generated $391 billion in annual revenue for the twelve-month period ending September 27, 2025.",
          page_number: 43,
          similarity_score: 0.99,
          dense_score: 0.97,
          bm25_score: 16.20,
          retrieval_method: "hybrid",
          matched_keywords: ["company", "generated", "391", "billion", "annual", "revenue"],
        },
        "LOW",
        {
          hallucination_type: "NONE",
          hallucination_risk_score: 0.02,
          reasoning_summary: "Exact factual alignment confirmed on Page 43 ($391.0B total net sales). Zero numerical variance detected.",
          numerical_finding: {
            comparison_outcome: "VALIDATED",
            formula: "$391B Total Net Sales",
            computed_result: 391.0,
            reported_result: 391.0,
            tolerance: 1.0,
            explanation: "Consolidated statement of operations validates $391 billion annual revenue.",
          },
          temporal_anchor: {
            period_match: "ALIGNED",
            claim_period: "FY2025",
            evidence_period: "FY2025",
            document_period: "FY2025",
            explanation: "Matches annual filing period ending September 27, 2025.",
          },
        }
      ),
      claim(
        "c3",
        "Operating margin nearly doubled year-over-year.",
        "Financial Metric",
        { entailment: 0.04, contradiction: 0.9, neutral: 0.06, label: "CONTRADICTED" },
        {
          text: "Operating margin improved slightly compared to the prior fiscal year, expanding from 29.8% to 30.5%.",
          page_number: 45,
          similarity_score: 0.88,
          dense_score: 0.84,
          bm25_score: 12.40,
          retrieval_method: "hybrid",
          matched_keywords: ["operating", "margin", "improved", "slightly", "prior", "fiscal", "year"],
        },
        "HIGH",
        {
          hallucination_type: "NUMERICAL_DISCREPANCY",
          hallucination_risk_score: 0.92,
          reasoning_summary: "High-confidence hallucination: LLM asserted operating margin 'nearly doubled' (+100%), whereas filing evidence proves operating margin increased by only 70 basis points (+0.7%) from 29.8% to 30.5%.",
          numerical_finding: {
            comparison_outcome: "MISMATCH",
            formula: "YoY Margin Delta: 30.5% - 29.8% = +0.7%",
            computed_result: 0.7,
            reported_result: 100.0,
            tolerance: 2.0,
            explanation: "Delta discrepancy of +99.3 percentage points. Operating margin grew slightly, far below 'doubled'.",
          },
          temporal_anchor: {
            period_match: "ALIGNED",
            claim_period: "FY2025",
            evidence_period: "FY2025",
            document_period: "FY2025",
            explanation: "Filing page covers fiscal year comparison.",
          },
        }
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
        {
          text: "iPhone net sales were relatively flat year-over-year as foreign exchange headwinds offset unit demand.",
          page_number: 45,
          similarity_score: 0.85,
          dense_score: 0.82,
          bm25_score: 11.90,
          retrieval_method: "hybrid",
          matched_keywords: ["iphone", "sales", "demand", "year-over-year"],
        },
        "HIGH",
        {
          hallucination_type: "FACTUAL_CONTRADICTION",
          hallucination_risk_score: 0.85,
          reasoning_summary: "Contradiction detected: Cross-encoder identified directional discrepancy between claim assertion of 'significant increase' and filing evidence stating net sales were 'flat'.",
        }
      ),
      claim(
        "c5",
        "iPhone demand remained strong throughout the year.",
        "Business Event",
        { entailment: 0.95, contradiction: 0.02, neutral: 0.03, label: "SUPPORTED" },
        {
          text: "iPhone demand remained strong throughout the year across emerging and developed markets.",
          page_number: 45,
          similarity_score: 0.98,
          dense_score: 0.96,
          bm25_score: 15.10,
          retrieval_method: "hybrid",
          matched_keywords: ["iphone", "demand", "remained", "strong", "throughout", "year"],
        },
        "LOW",
        {
          hallucination_type: "NONE",
          hallucination_risk_score: 0.05,
          reasoning_summary: "Passage directly matches LLM claim with high lexical and semantic overlap.",
        }
      ),
      claim(
        "c6",
        "iPhone Pro Max sales exceeded 40% of total iPhone unit volume.",
        "Financial Metric",
        { entailment: 0.06, contradiction: 0.06, neutral: 0.88, label: "UNVERIFIABLE" },
        null,
        "MEDIUM",
        {
          hallucination_type: "UNSUPPORTED_FABRICATION",
          hallucination_risk_score: 0.74,
          reasoning_summary: "Unsupported claim: Apple 10-K does not disclose individual model unit breakdown by percentage. Synthetic hallucination by LLM.",
        }
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
        {
          text: "Operating margin improved slightly compared to the prior fiscal year, expanding to 30.5%.",
          page_number: 45,
          similarity_score: 0.99,
          dense_score: 0.97,
          bm25_score: 15.60,
          retrieval_method: "hybrid",
          matched_keywords: ["operating", "margin", "improved", "slightly", "prior", "fiscal", "year"],
        },
        "LOW",
        {
          hallucination_type: "NONE",
          hallucination_risk_score: 0.03,
          reasoning_summary: "High textual alignment with operating margin commentary on Page 45.",
        }
      ),
      claim(
        "c8",
        "The company's operating margin declined this year.",
        "Financial Metric",
        { entailment: 0.03, contradiction: 0.94, neutral: 0.03, label: "CONTRADICTED" },
        {
          text: "Operating margin improved slightly compared to the prior fiscal year, rising to 30.5%.",
          page_number: 45,
          similarity_score: 0.90,
          dense_score: 0.89,
          bm25_score: 13.10,
          retrieval_method: "hybrid",
          matched_keywords: ["operating", "margin", "improved", "fiscal", "year"],
        },
        "HIGH",
        {
          hallucination_type: "FACTUAL_CONTRADICTION",
          hallucination_risk_score: 0.94,
          reasoning_summary: "Factual contradiction: Filing states operating margin expanded to 30.5%, directly refuting claim of decline.",
        }
      ),
      claim(
        "c9",
        "Revenue will double next year.",
        "Future Projection",
        { entailment: 0.05, contradiction: 0.05, neutral: 0.9, label: "UNVERIFIABLE" },
        {
          text: "No forward-looking guidance in this section indicates revenue doubling.",
          page_number: 0,
          similarity_score: 0.12,
          retrieval_method: "hybrid",
        },
        "MEDIUM",
        {
          hallucination_type: "UNSUPPORTED_FABRICATION",
          hallucination_risk_score: 0.70,
          reasoning_summary: "Forward-looking claim with zero evidence in historical 10-K report.",
        }
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
