import { PDFDocument } from 'pdf-lib';
import type { EmployerSettings } from '../employerSettings.js';
import { getEmployerSettings } from '../employerSettings.js';
import { getStorageBuffer } from '../storage.js';
import type { workers } from '../../db/schema.js';
import { embedPdfFonts } from './pdfFonts.js';
import { drawWrappedParagraph } from './pdfWrap.js';

type Worker = typeof workers.$inferSelect;

export type ContractDpcPdfOptions = {
  workerSignaturePng?: Uint8Array | null;
  employerSignaturePng?: Uint8Array | null;
  signedDate?: Date | null;
};

function formatSignedDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d);
}

export async function buildContractDpcPdf(
  worker: Worker,
  employer: EmployerSettings,
  options?: ContractDpcPdfOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { regular: font, bold } = await embedPdfFonts(doc);
  const page = doc.addPage([595, 842]);
  const margin = 50;
  const contentWidth = 595 - margin * 2;
  let y = 800;

  const paragraph = (text: string, size = 11, useBold = false) => {
    const f = useBold ? bold : font;
    y = drawWrappedParagraph(page, text, margin, y, f, size, contentWidth);
    y -= 4;
  };

  paragraph('DOHODA O PROVEDENÍ ČINNOSTI', 14, true);
  y -= 4;
  paragraph(`Zaměstnavatel: ${employer.name}`);
  paragraph(`Sídlo: ${employer.address}`);
  paragraph(`IČ: ${employer.ico}`);
  y -= 2;
  const employeeParts = [
    `Zaměstnanec: ${worker.firstName} ${worker.lastName}`,
    `nar. ${worker.birthDate ?? '…………'}`,
    `bytem ${worker.address ?? '…………'}`,
  ];
  if (worker.healthInsurance) {
    employeeParts.push(`zdravotní pojišťovna: ${worker.healthInsurance}`);
  }
  paragraph(employeeParts.join(', '));
  y -= 4;
  paragraph(`1. Sjednaný pracovní úkol: ${worker.position}`);
  paragraph('2. Sjednaný rozsah práce: práce nebude přesahovat 300 hodin v kalendářním roce.');
  paragraph(
    `3. Doba trvání: v období od ${worker.contractStart ?? '…………'} do ${worker.contractEnd ?? '…………'}`
  );
  paragraph(`4. Místo výkonu práce: ${worker.workPlace}`);
  paragraph('5. Zaměstnanec bude úkol plnit osobně.');
  paragraph(`6. Odměna: ${Math.round(worker.hourlyRateCents / 100)} Kč/hod`);
  paragraph(
    '7. Odměna je splatná v hotovosti nebo bezhotovostně do 10. dne následujícího kalendářního měsíce.'
  );
  paragraph(
    '8. Zaměstnanec prohlašuje, že byl seznámen s právy a povinnostmi a předpisy BOZP; zaměstnavatel zajistí bezpečné pracovní podmínky.'
  );
  y -= 8;

  const dateText = options?.signedDate ? formatSignedDate(options.signedDate) : '…………';
  paragraph(`V ${worker.workPlace} dne ${dateText}`);

  const sigY = y - 50;
  const sigW = 150;
  const sigH = 45;
  const leftX = margin;
  const rightX = 310;

  const drawSig = async (png: Uint8Array | null | undefined, x: number) => {
    if (!png?.length) {
      page.drawLine({ start: { x, y: sigY }, end: { x: x + 180, y: sigY }, thickness: 0.5 });
      return;
    }
    try {
      const img = await doc.embedPng(png);
      page.drawImage(img, { x, y: sigY - sigH + 5, width: sigW, height: sigH });
    } catch {
      page.drawLine({ start: { x, y: sigY }, end: { x: x + 180, y: sigY }, thickness: 0.5 });
    }
  };

  await drawSig(options?.workerSignaturePng, leftX);
  await drawSig(options?.employerSignaturePng, rightX);

  y = sigY - sigH - 8;
  page.drawText('podpis zaměstnance', { x: leftX, y, size: 9, font });
  page.drawText('podpis zaměstnavatele', { x: rightX, y, size: 9, font });

  return doc.save();
}

/** Sestaví PDF včetně podpisů uložených u zaměstnance / zaměstnavatele. */
export async function buildContractDpcPdfForWorker(worker: Worker): Promise<Uint8Array> {
  const employer = await getEmployerSettings();
  const workerSig = worker.contractSignatureWorkerKey
    ? await getStorageBuffer(worker.contractSignatureWorkerKey)
    : null;
  const employerSig = worker.contractSignatureEmployerKey
    ? await getStorageBuffer(worker.contractSignatureEmployerKey)
    : employer.signatureStorageKey
      ? await getStorageBuffer(employer.signatureStorageKey)
      : null;

  return buildContractDpcPdf(worker, employer, {
    workerSignaturePng: workerSig,
    employerSignaturePng: employerSig,
    signedDate: worker.contractSignedAt,
  });
}
