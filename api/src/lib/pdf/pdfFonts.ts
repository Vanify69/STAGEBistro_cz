import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(here, '../../../assets/fonts');

let regularBytes: Uint8Array | null = null;
let boldBytes: Uint8Array | null = null;

async function loadFontFiles(): Promise<void> {
  if (!regularBytes) {
    regularBytes = await readFile(path.join(fontsDir, 'NotoSans-Regular.ttf'));
  }
  if (!boldBytes) {
    boldBytes = await readFile(path.join(fontsDir, 'NotoSans-Bold.ttf'));
  }
}

export async function embedPdfFonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  doc.registerFontkit(fontkit);
  await loadFontFiles();
  const regular = await doc.embedFont(regularBytes!);
  const bold = await doc.embedFont(boldBytes!);
  return { regular, bold };
}
