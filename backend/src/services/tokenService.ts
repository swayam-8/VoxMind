import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  workspaceId?: string;
  isSuperuser?: boolean;
  tokenVersion?: number;
  purpose?: 'session';
}

export class TokenService {
  static sign(payload: JwtPayload): string {
    return jwt.sign({ ...payload, purpose: 'session' }, config.jwtSecret, {
      algorithm: 'HS256', issuer: 'voxmind', audience: 'voxmind-api',
      expiresIn: config.jwtExpiresIn as any,
    });
  }

  static verify(token: string): JwtPayload {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'], issuer: 'voxmind', audience: 'voxmind-api',
    }) as JwtPayload;
    if (payload.purpose !== 'session' || typeof payload.userId !== 'string') throw new Error('Invalid token purpose');
    return payload;
  }
}
