import { Router } from 'express';
import { DiagnosticsController } from './diagnostics.controller.js';

const router = Router();

router.get('/health', DiagnosticsController.getHealth);
router.get('/ready', DiagnosticsController.getReadiness);
router.get('/diagnostics', DiagnosticsController.getDiagnostics);

export const diagnosticsRoutes = router;
