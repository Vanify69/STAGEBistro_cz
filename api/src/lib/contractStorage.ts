import crypto from 'node:crypto';
import type { workers } from '../db/schema.js';
import { mimeForContractKey } from './contractFile.js';
import { asciiFilename } from './pdf/pdfText.js';
import { buildContractDpcPdfForWorker } from './pdf/contractDpc.js';
import { getStorageBuffer, putStorageBuffer } from './storage.js';

type Worker = typeof workers.$inferSelect;

export async function persistWorkerContractPdf(
  worker: Worker
): Promise<{ key: string; pdf: Uint8Array }> {
  const pdf = await buildContractDpcPdfForWorker(worker);
  const key =
    worker.contractPdfKey?.endsWith('.pdf')
      ? worker.contractPdfKey
      : `stagebistro/workers/${worker.id}/contract/${crypto.randomUUID()}.pdf`;
  await putStorageBuffer(key, pdf, 'application/pdf');
  return { key, pdf };
}

export type ResolvedContractFile =
  | {
      ok: true;
      buf: Uint8Array;
      contentType: string;
      filenameExt: string;
      regenerated: boolean;
      newPdfKey?: string;
    }
  | { ok: false; status: 404 | 500; error: string };

function canRegenerateContract(worker: Worker): boolean {
  return worker.contractSource === 'generated' || Boolean(worker.contractSignatureWorkerKey);
}

export async function resolveWorkerContractFile(worker: Worker): Promise<ResolvedContractFile> {
  if (worker.contractPdfKey) {
    const buf = await getStorageBuffer(worker.contractPdfKey);
    if (buf) {
      return {
        ok: true,
        buf,
        contentType: mimeForContractKey(worker.contractPdfKey),
        filenameExt: worker.contractPdfKey.split('.').pop() ?? 'pdf',
        regenerated: false,
      };
    }
  }

  if (!canRegenerateContract(worker)) {
    if (worker.contractSource === 'scan') {
      return {
        ok: false,
        status: 404,
        error: 'Sken smlouvy v úložišti chybí — nahrajte prosím znovu',
      };
    }
    return { ok: false, status: 404, error: 'Soubor smlouvy nenalezen' };
  }

  try {
    const { key, pdf } = await persistWorkerContractPdf(worker);
    const newPdfKey = key !== worker.contractPdfKey ? key : undefined;
    return {
      ok: true,
      buf: pdf,
      contentType: 'application/pdf',
      filenameExt: 'pdf',
      regenerated: true,
      newPdfKey,
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'PDF nelze znovu vytvořit',
    };
  }
}

export function contractFileResponseHeaders(
  worker: Worker,
  result: Extract<ResolvedContractFile, { ok: true }>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': result.contentType,
    'Content-Disposition': `inline; filename="smlouva-dpc-${asciiFilename(worker.lastName)}.${result.filenameExt}"`,
  };
  if (result.regenerated) headers['X-Contract-Regenerated'] = '1';
  return headers;
}
