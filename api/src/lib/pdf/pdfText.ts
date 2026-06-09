/** Helvetica (WinAnsi) v pdf-lib neumí českou diakritiku — převod na ASCII. */
export function pdfSafeText(text: string): string {
  const map: Record<string, string> = {
    á: 'a', Á: 'A', č: 'c', Č: 'C', ď: 'd', Ď: 'D', é: 'e', É: 'E', ě: 'e', Ě: 'E',
    í: 'i', Í: 'I', ň: 'n', Ň: 'N', ó: 'o', Ó: 'O', ř: 'r', Ř: 'R', š: 's', Š: 'S',
    ť: 't', Ť: 'T', ú: 'u', Ú: 'U', ů: 'u', Ů: 'U', ý: 'y', Ý: 'Y', ž: 'z', Ž: 'Z',
    '…': '...', '–': '-', '—': '-',
  };
  return text
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^\x00-\xFF]/g, '?');
}

/** Bezpecny nazev souboru pro HTTP hlavicky (jen ASCII). */
export function asciiFilename(name: string): string {
  const safe = pdfSafeText(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || 'dokument';
}
