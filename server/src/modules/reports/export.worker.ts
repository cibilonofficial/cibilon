import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import { getUserIdentity } from '../users/user-identity.js';
import { buildExportRows } from './report.service.js';

function flattenRow(row: Record<string, unknown>) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return output;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  const flat = rows.map(flattenRow);
  const headers = [...new Set(flat.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(','), ...flat.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))].join('\r\n');
}

function pdfEscape(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function rowsToPdf(reportType: string, rows: Record<string, unknown>[]) {
  const lines = [
    `Cibilon ${reportType} report`,
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${rows.length}`,
    '',
    ...rows.slice(0, 40).map((row) => JSON.stringify(flattenRow(row)).slice(0, 105)),
    ...(rows.length > 40 ? ['', 'Preview limited to 40 rows. Use CSV for the complete export.'] : []),
  ];
  const stream = ['BT', '/F1 9 Tf', '40 800 Td', ...lines.flatMap((line, index) => [index ? '0 -18 Td' : '', `(${pdfEscape(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function processNextExportJob() {
  const queued = await prisma.exportJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
  if (!queued) return false;
  const claimed = await prisma.exportJob.updateMany({
    where: { id: queued.id, status: 'QUEUED' },
    data: { status: 'PROCESSING', startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) return true;
  try {
    const identity = await getUserIdentity(queued.requestedByUserId);
    if (!identity) throw new Error('Export requester no longer exists');
    const user = { ...identity, sessionId: 'export-worker' } as RequestUser;
    const filters = (queued.filters ?? {}) as Record<string, unknown>;
    const rows = await buildExportRows(queued.reportType, filters, user) as Record<string, unknown>[];
    const extension = queued.format.toLowerCase();
    const fileName = `cibilon-${queued.reportType.toLowerCase()}-${queued.id}.${extension}`;
    const root = path.resolve(env.EXPORT_STORAGE_PATH);
    await mkdir(root, { recursive: true });
    const filePath = path.resolve(root, fileName);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Unsafe export path');
    const content = queued.format === 'CSV' ? Buffer.from(rowsToCsv(rows), 'utf8') : rowsToPdf(queued.reportType, rows);
    await writeFile(filePath, content);
    await prisma.exportJob.update({
      where: { id: queued.id },
      data: {
        status: 'COMPLETED', fileName, filePath,
        mimeType: queued.format === 'CSV' ? 'text/csv; charset=utf-8' : 'application/pdf',
        rowCount: rows.length, completedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    await prisma.notification.create({
      data: { recipientUserId: queued.requestedByUserId, type: 'REPORT_ACTION', title: 'Report export ready', body: `${queued.reportType} ${queued.format} export is ready to download.` },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown export error';
    await prisma.exportJob.update({ where: { id: queued.id }, data: { status: 'FAILED', errorMessage: message, completedAt: new Date() } });
    logger.error({ err: error, exportJobId: queued.id }, 'Report export failed');
  }
  return true;
}
