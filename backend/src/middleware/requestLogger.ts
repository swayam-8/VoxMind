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
  // OAuth codes, state nonces, session tokens and redirect headers must never enter logs.
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split('?')[0], remoteAddress: req.remoteAddress }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
