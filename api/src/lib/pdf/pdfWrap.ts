import type { PDFFont, PDFPage } from 'pdf-lib';

export function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function drawWrappedParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  lineHeight = 4
): number {
  const lines = wrapText(text, font, fontSize, maxWidth);
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size: fontSize, font });
    cursorY -= fontSize + lineHeight;
  }
  return cursorY;
}
