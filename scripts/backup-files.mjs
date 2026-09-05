import 'dotenv/config';
import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const backupRoot = path.resolve(process.env.FILE_BACKUP_DIR ?? './backups/files');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(backupRoot, timestamp);
const sources = [
  ['documents', path.resolve(process.env.LOCAL_STORAGE_PATH ?? './storage/documents')],
  ['exports', path.resolve(process.env.EXPORT_STORAGE_PATH ?? './storage/exports')],
];
await mkdir(destination, { recursive: true });
for (const [name, source] of sources) {
  if (source === path.parse(source).root || backupRoot.startsWith(`${source}${path.sep}`)) {
    throw new Error(`Unsafe backup source: ${source}`);
  }
  try {
    if (!(await stat(source)).isDirectory()) continue;
    await cp(source, path.join(destination, name), { recursive: true, errorOnExist: true });
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
console.log(`File backup created: ${destination}`);
