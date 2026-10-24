import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

/** Canonical paths stop stale/malformed records or symlinks escaping upload storage. */
export async function recordingPath(filePath: string) {
  try {
    const root = await fs.realpath(config.uploadDir);
    const file = await fs.realpath(filePath);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative) || !(await fs.stat(file)).isFile()) throw new Error('Outside storage');
    return file;
  } catch { throw new AppError('Recording file is unavailable', 404, 'FILE_NOT_FOUND'); }
}
