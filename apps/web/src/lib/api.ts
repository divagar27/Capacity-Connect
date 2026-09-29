export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** All browser requests use the Next.js same-origin API rewrite so auth cookies stay first-party. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/${path.replace(/^\//, '')}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(init.body && !(typeof FormData !== 'undefined' && init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | { message?: string; error?: string }
    | null;

  if (!response.ok || !payload || !('data' in payload)) {
    const message = payload && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join(', ') : payload.message
      : 'The service could not complete this request.';
    throw new ApiError(message || 'The service could not complete this request.', response.status);
  }

  return payload.data;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
