import axios from 'axios';
import { clearToken, getToken, type AuthUser } from './auth';

// ---------------------------------------------------------------------------
// Base URL — configurable via environment variable
// ---------------------------------------------------------------------------
// "/" means the same address that served the page (the API hosts the interface); trailing slashes are dropped so paths join cleanly.
const API_BASE_URL = String(
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000',
).replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Every request carries the signed-in user's token.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// An expired or revoked session sends the user back to the login page. The calls that are *meant* to
// answer 401 (login, registration, the initial "who am I") handle it themselves.
const SELF_HANDLED_401 = ['/auth/login', '/auth/register', '/auth/me'];
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? '';
    const publicPage = ['/', '/login', '/signup'].includes(window.location.pathname);
    if (error?.response?.status === 401 && !SELF_HANDLED_401.some((p) => url.includes(p)) && !publicPage) {
      clearToken();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

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
  dense_score?: number | null;
  bm25_score?: number | null;
  retrieval_method?: string;
  matched_keywords?: string[];
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
  hallucination_type?: string | null;
  hallucination_risk_score?: number | null;
  reasoning_summary?: string | null;
  multi_hop_finding?: any;
  decided_by?: string | null;
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
    '/api/v1/documents/upload',
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
  const response = await api.get<DocumentResponse>(`/api/v1/documents/${documentId}`);
  return response.data;
}

/**
 * URL for retrieving the raw PDF document for in-browser PDF viewing.
 */
export function getDocumentFileUrl(documentId: string): string {
  return `${API_BASE_URL}/api/v1/documents/${documentId}/file`;
}

/**
 * Start the verification pipeline for an LLM output against an uploaded
 * document.
 */
export async function startVerification(
  documentId: string,
  llmOutput: string,
  retrievalMode?: string,
): Promise<VerificationResultResponse> {
  const payload: any = { document_id: documentId, llm_output: llmOutput };
  if (retrievalMode) {
    payload.retrieval_mode = retrievalMode;
  }
  const response = await api.post<VerificationResultResponse>(
    '/api/v1/verification/start',
    payload,
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
    `/api/v1/verification/${verificationId}/results`,
  );
  return response.data;
}

/**
 * Run the built-in demo verification with canned data.
 */
export async function runDemo(): Promise<DemoRunResponse> {
  const response = await api.post<DemoRunResponse>('/api/v1/demo/run');
  return response.data;
}

/**
 * Check system health (backend, database, embedding model, NLI model).
 */
export async function getSystemHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/api/v1/system/health');
  return response.data;
}

export interface EngineConfig {
  pipeline_version: string;
  models: { embedding: string; nli: string; reranker: string | null };
  retrieval: { mode: string; fusion: string; top_k: number };
  policy: {
    aggregation: string;
    nli_contradiction_threshold: number;
    nli_support_threshold: number;
    grounded_support_min_overlap: number;
    multi_figure_support_min_overlap: number;
    disabled_checks: string[];
  };
  ocr: { confidence_threshold: number };
  llm: { provider: string; model: string | null };
}

/** The values the engine is running with (read-only; set by the server's environment). */
export async function getEngineConfig(): Promise<EngineConfig> {
  const response = await api.get<EngineConfig>('/api/v1/system/config');
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
        text: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-400/30',
      };
    case 'CONTRADICTED':
    case 'CONTRADICTION':
      return {
        text: 'text-rose-300',
        bg: 'bg-rose-500/10',
        border: 'border-rose-400/30',
      };
    default:
      return {
        text: 'text-amber-300',
        bg: 'bg-amber-500/10',
        border: 'border-amber-400/30',
      };
  }
}


/**
 * Fetch all extracted text chunks and OCR metadata for a document.
 */
export async function getDocumentChunks(documentId: string): Promise<any> {
  const response = await api.get(`/api/v1/documents/${documentId}/chunks`);
  return response.data;
}

/**
 * Fetch all structured financial tables extracted from a document.
 */
export async function getDocumentTables(documentId: string): Promise<any> {
  const response = await api.get(`/api/v1/documents/${documentId}/tables`);
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
  const response = await api.get<ReviewItem[]>('/api/v1/review/queue', { params });
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
    `/api/v1/review/${itemId}/decide`,
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
    `/api/v1/review/${itemId}/audit`,
  );
  return response.data;
}

/**
 * Fetch safe LLM readiness and configuration status.
 */
export async function getLlmHealth(): Promise<any> {
  const response = await api.get('/api/v1/system/llm/health');
  return response.data;
}

export interface ExtractedFactItem {
  claim_text: string;
  claim_type: string;
  entity?: string | null;
  metric?: string | null;
  value?: number | null;
  unit?: string | null;
  reporting_period?: string | null;
}

export interface DocumentExtractFactsResponse {
  document_id: string;
  summary_text: string;
  facts: ExtractedFactItem[];
  total_facts: number;
  provider_used: string;
}

/**
 * Extracts facts and financial statements from an uploaded document using LLM.
 */
export async function extractFactsFromDocument(
  documentId: string
): Promise<DocumentExtractFactsResponse> {
  const response = await api.post<DocumentExtractFactsResponse>(
    `/api/v1/documents/${documentId}/extract-facts`
  );
  return response.data;
}


// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

/** The message the backend gave for a failed call, or a fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/login', { email, password })).data;
}

export async function registerRequest(email: string, password: string, name: string, code?: string): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/register', { email, password, name, code: code || undefined })).data;
}

/** Which sign-in methods the server offers. */
export interface AuthOptions {
  password: boolean;
  google_client_id: string | null;
  email_otp: boolean;
  registration: boolean;
  /** Sign-up must prove the address with an emailed code first. */
  registration_needs_code: boolean;
  /** "Forgot password" by emailed code is available. */
  password_reset: boolean;
}

export async function fetchAuthOptions(): Promise<AuthOptions> {
  return (await api.get<AuthOptions>('/api/v1/auth/options')).data;
}

export async function requestOtp(email: string): Promise<{ detail: string; resend_after_seconds: number }> {
  return (await api.post('/api/v1/auth/otp/request', { email })).data;
}

export async function verifyOtp(email: string, code: string, name?: string): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/otp/verify', { email, code, name: name || undefined })).data;
}

export async function googleLoginRequest(credential: string): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/google', { credential })).data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return (await api.get<AuthUser>('/api/v1/auth/me')).data;
}

/** The raw PDF as bytes, fetched with the user's credentials (a plain URL cannot carry them). */
export async function fetchDocumentFile(documentId: string): Promise<Uint8Array> {
  const response = await api.get<ArrayBuffer>(`/api/v1/documents/${documentId}/file`, { responseType: 'arraybuffer' });
  return new Uint8Array(response.data);
}

/** Downloads a finished verification as a PDF report or a CSV of its claims. */
export async function downloadReport(verificationId: string, format: 'pdf' | 'csv'): Promise<void> {
  const response = await api.get<Blob>(`/api/v1/verification/${verificationId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `verifin-report-${verificationId.slice(0, 8)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export interface AdminOverview {
  usage: {
    window_days: number;
    verifications: number;
    by_status: Record<string, number>;
    by_risk: Record<string, number>;
    average_score: number | null;
    documents: number;
  };
  people: {
    users: number;
    active_users: number;
    by_role: Record<string, number>;
    api_keys_active: number;
    api_keys_total: number;
    last_login_at: string | null;
  };
  audit: { events: number; chain_valid: boolean; head_hash: string; first_broken_seq: number | null };
  instance: {
    app_version: string;
    pipeline_version: string;
    environment: string;
    auth_enabled: boolean;
    jobs_running: number;
    jobs_waiting: number;
    max_concurrent_jobs: number;
    job_queue_limit: number;
    models: Record<string, string | null>;
  };
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  role: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  seq: number;
  timestamp: string;
  actor_id: string;
  actor_email: string | null;
  actor_role: string | null;
  auth_method: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  outcome: string;
  request_id: string | null;
  details: Record<string, unknown>;
  hash: string;
}

export interface AuditChainStatus {
  valid: boolean;
  events: number;
  head_hash: string;
  first_broken_seq: number | null;
  reason: string | null;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return (await api.get<AdminOverview>('/api/v1/admin/overview')).data;
}

export async function listUsers(): Promise<AuthUser[]> {
  return (await api.get<AuthUser[]>('/api/v1/auth/users')).data;
}

export async function createUser(email: string, password: string, role: string, name?: string): Promise<AuthUser> {
  return (await api.post<AuthUser>('/api/v1/auth/users', { email, password, role, name })).data;
}

export async function updateUser(id: string, fields: { role?: string; is_active?: boolean }): Promise<AuthUser> {
  return (await api.patch<AuthUser>(`/api/v1/auth/users/${id}`, fields)).data;
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  return (await api.get<ApiKeyInfo[]>('/api/v1/auth/api-keys')).data;
}

export async function createApiKey(name: string, role: string, expiresInDays?: number): Promise<ApiKeyInfo & { key: string }> {
  return (await api.post('/api/v1/auth/api-keys', { name, role, expires_in_days: expiresInDays })).data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/api/v1/auth/api-keys/${id}`);
}

export async function listAuditEvents(params: { action?: string; limit?: number; before_seq?: number }): Promise<AuditEvent[]> {
  return (await api.get<AuditEvent[]>('/api/v1/audit/events', { params })).data;
}

export async function verifyAuditChain(): Promise<AuditChainStatus> {
  return (await api.get<AuditChainStatus>('/api/v1/audit/verify')).data;
}

// ---------------------------------------------------------------------------
// Verification history
// ---------------------------------------------------------------------------

export interface VerificationSummary {
  id: string;
  document_id: string;
  document_name: string | null;
  statement_preview: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  risk_level: string;
  overall_score: number;
  /** verdict -> number of claims; empty for runs recorded before counts were stored */
  claim_counts: Record<string, number>;
  created_at: string;
}

export async function listVerifications(limit = 100): Promise<VerificationSummary[]> {
  return (await api.get<VerificationSummary[]>('/api/v1/verification', { params: { limit } })).data;
}

// ---------------------------------------------------------------------------
// Password reset and the signed-in account
// ---------------------------------------------------------------------------

export async function requestPasswordReset(email: string): Promise<{ detail: string; resend_after_seconds: number }> {
  return (await api.post('/api/v1/auth/password/reset/request', { email })).data;
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<{ detail: string }> {
  return (await api.post('/api/v1/auth/password/reset/confirm', { email, code, new_password: newPassword })).data;
}

/** Other sessions end; the response carries a fresh token for this one. */
export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/password/change', { current_password: currentPassword, new_password: newPassword })).data;
}

export async function revokeOtherSessions(): Promise<TokenResponse> {
  return (await api.post<TokenResponse>('/api/v1/auth/sessions/revoke')).data;
}

export async function updateProfile(name: string): Promise<AuthUser> {
  return (await api.patch<AuthUser>('/api/v1/auth/me', { name })).data;
}
