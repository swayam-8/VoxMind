import { Router } from 'express';
import { ApiKeysController } from './api-keys.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { createApiKeySchema } from './api-keys.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', ApiKeysController.list);
router.post(
  '/',
  requireRole(['owner', 'admin']),
  validateRequest({ body: createApiKeySchema }),
  ApiKeysController.create
);
router.delete('/:id', requireRole(['owner', 'admin']), ApiKeysController.revoke);

export const apiKeyRoutes = router;
