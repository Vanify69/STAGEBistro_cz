const trimSlash = (s: string) => s.replace(/\/$/, '');

export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.length > 0) return trimSlash(fromEnv);
  return '';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const hasJsonBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data ? String((data as { error: string }).error) : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data as T;
}
