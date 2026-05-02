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
  const res = await fetch(url, {
    ...rest,
    credentials,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const trimmedStart = text.trimStart();
  if (trimmedStart.startsWith('<')) {
    const hint =
      !base && import.meta.env.PROD
        ? ' Nastavte VITE_API_URL na veřejnou URL API služby a znovu sestavte web (Railway Variables u Web).'
        : ' Zkontrolujte VITE_API_URL a že API běží a vrací JSON na dané cestě.';
    throw new Error(`Odpověď není JSON (dostali jsme HTML).${hint}`);
  }

  let data: unknown = null;
  if (trimmedStart) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      const hint =
        res.status >= 500
          ? ' API pravděpodobně hodilo výjimku dříve, než stihlo vrátit JSON — zkontroluj terminál API a databázi (Postgres musí běžet: `npm run db:up`, port v api/.env odpovídá kontejneru).'
          : '';
      throw new Error(
        `Odpověď není platný JSON (HTTP ${res.status}). Začátek těla: ${text.slice(0, 120).trim()}${hint}`
      );
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data as T;
}
