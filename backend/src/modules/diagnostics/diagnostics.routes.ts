import { Router } from 'express';
import { DiagnosticsController } from './diagnostics.controller.js';

import { authenticate, requireSession, requireOperator } from '../../middleware/auth.js';

const router = Router();

router.get('/health', DiagnosticsController.getHealth);
router.get('/ready', DiagnosticsController.getReadiness);
router.get('/diagnostics', authenticate, requireSession, requireOperator, DiagnosticsController.getDiagnostics);

export const diagnosticsRoutes = router;
