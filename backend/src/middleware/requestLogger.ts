import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    config.nodeEnv !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
