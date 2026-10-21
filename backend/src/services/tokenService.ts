import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  workspaceId?: string;
  isSuperuser?: boolean;
}

export class TokenService {
  static sign(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });
  }

  static verify(token: string): JwtPayload {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  }
}
