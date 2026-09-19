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

export interface Evidence {
  text: string;
  page_number: number;
  similarity_score: number;
}

export interface NLIResult {
  entailment: number;
  contradiction: number;
  neutral: number;
  label: string;
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
