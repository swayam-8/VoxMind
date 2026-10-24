import { Router } from 'express';
import { UsageController } from './usage.controller.js';
import { authenticate } from '../../middleware/auth.js';

import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }), UsageController.getUsage);

export const usageRoutes = router;
