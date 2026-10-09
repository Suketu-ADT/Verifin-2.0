import axios from 'axios';

// ---------------------------------------------------------------------------
// Base URL — configurable via environment variable
// ---------------------------------------------------------------------------
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// TypeScript interfaces — mirror backend schemas exactly
// ---------------------------------------------------------------------------

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: string;
  size: number;
  page_count: number;
  status: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page_number?: number;
}

export interface Evidence {
  text: string;
  page_number: number;
  similarity_score: number;
  bounding_box?: BoundingBox | null;
  is_ocr?: boolean;
  extraction_method?: string;
  ocr_confidence?: number | null;
  needs_review?: boolean;
  words?: any[] | null;
}

export interface NLIResult {
  entailment: number;
  contradiction: number;
  neutral: number;
  label: string;
}

export interface NumericalFinding {
  finding_type: string;
  formula: string | null;
  operands: Record<string, any>;
  computed_result: number | null;
  reported_result: number | null;
  tolerance: number | null;
  comparison_outcome: string;
  explanation: string;
}

export interface TemporalAnchor {
  claim_period: string | null;
  evidence_period: string | null;
  document_period: string | null;
  period_match: string;
  explanation: string;
}

export interface ClaimResponse {
  id: string;
  claim_text: string;
  claim_type: string;
  status: string;
  confidence: number | null;
  risk_level: string | null;
  source_sentence: string | null;
  evidence: Evidence | null;
  nli: NLIResult | null;
  numerical_finding?: NumericalFinding | null;
  temporal_anchor?: TemporalAnchor | null;
}

export interface VerificationResultResponse {
  id: string;
  document_id: string;
  overall_score: number;
  risk_level: string;
  status: string;
  claims: ClaimResponse[];
}

export interface HealthResponse {
  status: string;
  services: {
    backend: string;
    database: string;
    embedding: string;
    nli: string;
    llm?: string;
  };
}

export interface DemoRunResponse {
  status: string;
  message: string;
  session_id: string;
  claims_count: number;
  claims: ClaimResponse[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Upload a financial document (PDF, etc.) for parsing.
 */
export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<DocumentResponse>(
    '/api/documents/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    },
  );
  return response.data;
}

/**
 * Fetch metadata for an uploaded document.
 */
export async function getDocument(documentId: string): Promise<DocumentResponse> {
  const response = await api.get<DocumentResponse>(`/api/documents/${documentId}`);
  return response.data;
}

/**
 * URL for retrieving the raw PDF document for in-browser PDF viewing.
 */
export function getDocumentFileUrl(documentId: string): string {
  return `${API_BASE_URL}/api/documents/${documentId}/file`;
}

/**
 * Start the verification pipeline for an LLM output against an uploaded
 * document.
 */
export async function startVerification(
  documentId: string,
  llmOutput: string,
): Promise<VerificationResultResponse> {
  const response = await api.post<VerificationResultResponse>(
    '/api/verification/start',
    { document_id: documentId, llm_output: llmOutput },
  );
  return response.data;
}

/**
 * Fetch verification results by session id.
 */
export async function getVerificationResults(
  verificationId: string,
): Promise<VerificationResultResponse> {
  const response = await api.get<VerificationResultResponse>(
    `/api/verification/${verificationId}/results`,
  );
  return response.data;
}

/**
 * Run the built-in demo verification with canned data.
 */
export async function runDemo(): Promise<DemoRunResponse> {
  const response = await api.post<DemoRunResponse>('/api/demo/run');
  return response.data;
}

/**
 * Check system health (backend, database, embedding model, NLI model).
 */
export async function getSystemHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/api/system/health');
  return response.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable file size */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Map NLI label to a display-friendly string */
export function nliLabelDisplay(label: string): string {
  const map: Record<string, string> = {
    SUPPORTED: 'Supported',
    CONTRADICTED: 'Contradicted',
    UNVERIFIABLE: 'Unverifiable',
    ENTAILMENT: 'Supported',
    CONTRADICTION: 'Contradicted',
    NEUTRAL: 'Unverifiable',
  };
  return map[label.toUpperCase()] ?? label;
}

/** Map risk level to a colour class */
export function riskColor(level: string | null): string {
  switch (level?.toUpperCase()) {
    case 'LOW':
      return 'text-emerald-600';
    case 'MEDIUM':
      return 'text-amber-500';
    case 'HIGH':
      return 'text-rose-600';
    default:
      return 'text-slate-500';
  }
}

/** Map NLI label to colour classes */
export function nliColor(label: string): {
  text: string;
  bg: string;
  border: string;
} {
  switch (label.toUpperCase()) {
    case 'SUPPORTED':
    case 'ENTAILMENT':
      return {
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    case 'CONTRADICTED':
    case 'CONTRADICTION':
      return {
        text: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      };
    default:
      return {
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
  }
}

/**
 * Fetch all extracted text chunks and OCR metadata for a document.
 */
export async function getDocumentChunks(documentId: string): Promise<any> {
  const response = await api.get(`/api/documents/${documentId}/chunks`);
  return response.data;
}

/**
 * Fetch all structured financial tables extracted from a document.
 */
export async function getDocumentTables(documentId: string): Promise<any> {
  const response = await api.get(`/api/documents/${documentId}/tables`);
  return response.data;
}

// ---------------------------------------------------------------------------
// Human-in-the-Loop Review Queue
// ---------------------------------------------------------------------------

export interface ReviewAuditRecord {
  reviewer_id: string;
  action: 'accept' | 'correct' | 'reject';
  timestamp: string;
  previous_value?: number | null;
  new_value?: number | null;
  previous_text: string;
  new_text: string;
  reason: string;
}

export interface ReviewItem {
  id: string;
  document_id: string;
  user_id?: string | null;
  table_id?: string | null;
  page_number: number;
  cell_row_idx: number;
  cell_col_idx: number;
  line_item_name: string;
  original_text: string;
  original_value?: number | null;
  current_text: string;
  current_value?: number | null;
  ocr_confidence: number;
  reason_for_review: string;
  status: 'pending' | 'accepted' | 'corrected' | 'rejected';
  bbox?: {
    x0: number;
    top: number;
    x1: number;
    bottom: number;
  } | null;
  audit_trail: ReviewAuditRecord[];
  created_at: string;
  updated_at: string;
}

export interface ReviewDecisionRequest {
  reviewer_id: string;
  action: 'accept' | 'correct' | 'reject';
  reason: string;
  corrected_value?: number | null;
  corrected_text?: string | null;
}

/**
 * Fetch all pending review items.
 */
export async function getReviewQueue(
  documentId?: string,
  userId?: string,
): Promise<ReviewItem[]> {
  const params: Record<string, string> = {};
  if (documentId) params.document_id = documentId;
  if (userId) params.user_id = userId;
  const response = await api.get<ReviewItem[]>('/api/review/queue', { params });
  return response.data;
}

/**
 * Submit analyst decision (accept, correct, reject) for an uncertain item.
 */
export async function submitReviewDecision(
  itemId: string,
  decision: ReviewDecisionRequest,
  userId?: string,
): Promise<ReviewItem> {
  const params: Record<string, string> = {};
  if (userId) params.user_id = userId;
  const response = await api.post<ReviewItem>(
    `/api/review/${itemId}/decide`,
    decision,
    { params },
  );
  return response.data;
}

/**
 * Get immutable audit history for a review item.
 */
export async function getReviewAuditTrail(
  itemId: string,
): Promise<ReviewAuditRecord[]> {
  const response = await api.get<ReviewAuditRecord[]>(
    `/api/review/${itemId}/audit`,
  );
  return response.data;
}

/**
 * Fetch safe LLM readiness and configuration status.
 */
export async function getLlmHealth(): Promise<any> {
  const response = await api.get('/api/system/llm/health');
  return response.data;
}
