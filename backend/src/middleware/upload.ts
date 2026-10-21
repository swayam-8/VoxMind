import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
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
  'video/webm',
  'video/mp4',
  'application/octet-stream',
]);

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeMb * 1024 * 1024,
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
      // If extension is valid, allow application/octet-stream fallback
    }

    cb(null, true);
  },
});
