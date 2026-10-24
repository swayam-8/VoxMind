import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `recording-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.m4a',
  '.flac',
  '.ogg',
  '.webm',
  '.aac',
  '.opus',
  '.wma',
  '.mp4',
]);

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-ms-wma',
  'audio/opus',
  'video/webm',
  'video/mp4',
  'application/octet-stream',
]);

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeMb * 1024 * 1024,
    files: 1, fields: 5, parts: 6, fieldSize: 4096, fieldNameSize: 50, headerPairs: 50,
  },
  fileFilter: (_req: Request, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new AppError(
          `Unsupported file type: ${ext}. Allowed formats: WAV, MP3, M4A, FLAC, OGG, WEBM, AAC`,
          400,
          'INVALID_FILE_TYPE'
        )
      );
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(new AppError('Unsupported audio content type', 400, 'INVALID_FILE_TYPE'));
    }

    cb(null, true);
  },
});

/** Browser MIME types are untrusted: reject disguised HTML, scripts and playlists. */
export async function validateAudioContent(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();
  try {
    const file = await fs.promises.open(req.file.path, 'r');
    const header = Buffer.alloc(64);
    let length = 0;
    try { length = (await file.read(header, 0, header.length, 0)).bytesRead; }
    finally { await file.close(); }
    const starts = (value: string | number[], offset = 0) => header.subarray(offset, offset + value.length).equals(Buffer.from(value));
    let mime = '';
    if (length >= 12 && starts('RIFF') && starts('WAVE', 8)) mime = 'audio/wav';
    else if (length >= 12 && starts('ftyp', 4)) mime = 'audio/mp4';
    else if (starts('fLaC')) mime = 'audio/flac';
    else if (starts('OggS')) mime = 'audio/ogg';
    else if (starts([0x1a, 0x45, 0xdf, 0xa3])) mime = 'audio/webm';
    else if (starts([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11])) mime = 'audio/x-ms-wma';
    else if (starts('ID3') || (length >= 4 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0 && (header[1] & 0x06) !== 0)) mime = 'audio/mpeg';
    else if (length >= 4 && header[0] === 0xff && (header[1] & 0xf6) === 0xf0) mime = 'audio/aac';
    if (!mime) throw new AppError('File content is not a supported audio recording', 400, 'INVALID_AUDIO_CONTENT');
    req.file.mimetype = mime;
    await fs.promises.chmod(req.file.path, 0o600);
    next();
  } catch (error) {
    await fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    next(error);
  }
}
