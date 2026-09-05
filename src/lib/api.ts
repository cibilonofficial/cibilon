const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:4000/api/v1';

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function getApiAccessToken() {
  return accessToken;
}

async function parseError(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { error?: { code?: string; message?: string } }
    | null;
  return new ApiError(
    response.status,
    payload?.error?.code ?? 'REQUEST_FAILED',
    payload?.error?.message ?? `Request failed (${response.status})`,
  );
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as { data: { accessToken: string } };
        setApiAccessToken(payload.data.accessToken);
        return payload.data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  form?: FormData;
  skipRefresh?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, form, skipRefresh, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (accessToken) requestHeaders.set('authorization', `Bearer ${accessToken}`);
  if (body !== undefined) requestHeaders.set('content-type', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: requestHeaders,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  if (response.status === 401 && !skipRefresh && !path.startsWith('/auth/')) {
    const nextToken = await refreshAccessToken();
    if (nextToken) return apiRequest<T>(path, { ...options, skipRefresh: true });
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string): Promise<{ blob: Blob; fileName: string }> {
  const headers = new Headers();
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  let response = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers });
  if (response.status === 401 && await refreshAccessToken()) {
    headers.set('authorization', `Bearer ${accessToken}`);
    response = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers });
  }
  if (!response.ok) throw await parseError(response);
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition)?.[1] ?? 'download';
  return { blob: await response.blob(), fileName: decodeURIComponent(fileName) };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
