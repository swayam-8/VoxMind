import { Router } from 'express';
import { UsageController } from './usage.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', UsageController.getUsage);

export const usageRoutes = router;
