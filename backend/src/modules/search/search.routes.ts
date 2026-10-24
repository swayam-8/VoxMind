import { Router } from 'express';
import { SearchController } from './search.controller.js';
import { authenticate } from '../../middleware/auth.js';

import { validateRequest } from '../../middleware/validation.js';
import { searchSchema, ragAskSchema } from './search.schema.js';
import { expensiveRateLimit } from '../../middleware/rateLimit.js';

const router = Router();

router.use(authenticate);

// Support both GET /search and POST /search
router.get('/', expensiveRateLimit, validateRequest({ query: searchSchema }), SearchController.search);
router.post('/', expensiveRateLimit, validateRequest({ body: searchSchema }), SearchController.search);

export const searchRoutes = router;

// Knowledge routes
const knowledgeRouter = Router();
knowledgeRouter.use(authenticate);
knowledgeRouter.post('/ask', expensiveRateLimit, validateRequest({ body: ragAskSchema }), SearchController.askKnowledge);

export const knowledgeRoutes = knowledgeRouter;
