import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validation.js';
import { registerSchema, loginSchema, updateMeSchema } from './auth.schema.js';
import { loginRateLimit, registrationRateLimit } from '../../middleware/rateLimit.js';
import { authenticate, requireSession } from '../../middleware/auth.js';

const router = Router();

router.post('/register', registrationRateLimit, validateRequest({ body: registerSchema }), AuthController.register);
router.post('/login', loginRateLimit, validateRequest({ body: loginSchema }), AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
router.patch('/me', authenticate, requireSession, validateRequest({ body: updateMeSchema }), (req, res, next) => req.body.newPassword ? loginRateLimit(req, res, next) : next(), AuthController.updateMe);
router.put('/me', authenticate, requireSession, validateRequest({ body: updateMeSchema }), (req, res, next) => req.body.newPassword ? loginRateLimit(req, res, next) : next(), AuthController.updateMe);

export const authRoutes = router;
