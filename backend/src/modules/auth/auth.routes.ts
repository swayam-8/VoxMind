import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validation.js';
import { registerSchema, loginSchema, updateMeSchema } from './auth.schema.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', validateRequest({ body: registerSchema }), AuthController.register);
router.post('/login', validateRequest({ body: loginSchema }), AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
router.patch('/me', authenticate, validateRequest({ body: updateMeSchema }), AuthController.updateMe);
router.put('/me', authenticate, validateRequest({ body: updateMeSchema }), AuthController.updateMe);

export const authRoutes = router;
