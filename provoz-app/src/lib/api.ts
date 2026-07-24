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
  const credentials = init?.credentials ?? 'include';
  const { credentials: _c, ...rest } = init ?? {};

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      credentials,
      headers: {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Nelze se připojit k API — spusťte `npm run api:dev` (port 3001)');
  }
  const text = await res.text();
  const trimmedStart = text.trimStart();
  if (trimmedStart.startsWith('<')) {
    throw new Error(
      'API neodpovídá správně (HTML místo JSON). Spusťte `npm run api:dev` a zkontrolujte VITE_API_URL.'
    );
  }

  let data: unknown = null;
  if (trimmedStart) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Neplatná odpověď serveru (HTTP ${res.status}).`);
    }
  }

  if (!res.ok) {
    const msgFromBody =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : '';
    const fallback =
      res.status === 401
        ? 'Neplatný e-mail nebo heslo'
        : res.status === 403
          ? 'Nemáte oprávnění'
          : res.status === 404
            ? 'Nenalezeno'
            : res.status === 502 || res.status === 503 || res.statusText === 'Internal Server Error'
              ? 'API neodpovídá — spusťte `npm run api:dev` (port 3001)'
              : res.status >= 500
                ? 'Chyba serveru — zkuste to znovu'
                : res.statusText || `HTTP ${res.status}`;
    throw new Error(msgFromBody || fallback);
  }
  return data as T;
}
