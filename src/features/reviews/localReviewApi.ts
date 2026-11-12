/** Local session-backed Reviews API. Not an Atlassian/Jira API client. */
import type { ReviewData, ReviewListItem, ReviewSummary } from '../../shared/types/review';

export interface LocalReviewResponse {
  review: ReviewData;
  derived: ReviewSummary;
}

export type LocalReviewCommand = {
  type: string;
  expectedRevision: number;
  [field: string]: unknown;
};

const messages: Record<string, string> = {
  AUTH_REQUIRED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  NOT_AVAILABLE: 'El servicio de revisiones locales está deshabilitado.',
  REVIEW_NOT_FOUND: 'Esta revisión no existe en tu cuenta. Puedes crearla.',
  REVIEW_ALREADY_EXISTS: 'Ya existe una revisión con ese identificador en tu cuenta.',
  INVALID_ISSUE_KEY: 'Usa un identificador válido, por ejemplo ACO-142.',
  INVALID_SUMMARY: 'Escribe un resumen de entre 5 y 180 caracteres.',
  INVALID_PROJECT_KEY: 'El identificador del proyecto no es válido.',
  APPROVAL_BLOCKED: 'Faltan evidencias vigentes de los requisitos obligatorios.',
};

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', payload?: unknown, csrfToken?: string): Promise<T> {
  const response = await fetch('/api/local/reviews/' + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: method === 'POST'
      ? { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken ?? '' }
      : undefined,
    body: method === 'POST' ? JSON.stringify(payload) : undefined,
  });
  const json = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    const code = json.error ?? '';
    const description = messages[code] ?? (code.startsWith('CONFLICT')
      ? 'La revisión cambió en otra sesión. Recárgala antes de intentar guardar.'
      : code.startsWith('APPROVAL_BLOCKED')
        ? messages.APPROVAL_BLOCKED
        : code && !/[<>]/.test(code) ? code : 'No se pudo completar la operación.');
    throw new Error(description);
  }
  return json;
}

export async function listLocalReviews(): Promise<ReviewListItem[]> {
  const data = await request<{ reviews: ReviewListItem[] }>('');
  return data.reviews;
}

export function getLocalReview(issueKey: string): Promise<LocalReviewResponse> {
  return request<LocalReviewResponse>(encodeURIComponent(issueKey) + '/');
}

export function createLocalReview(issueKey: string, summary: string, csrfToken: string): Promise<LocalReviewResponse> {
  return request<LocalReviewResponse>('new/', 'POST', { issueKey, summary }, csrfToken);
}

export function commandLocalReview(issueKey: string, command: LocalReviewCommand, csrfToken: string): Promise<LocalReviewResponse> {
  return request<LocalReviewResponse>(encodeURIComponent(issueKey) + '/commands/', 'POST', { command }, csrfToken);
}
