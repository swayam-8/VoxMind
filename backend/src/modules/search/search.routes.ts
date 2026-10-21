import { Router } from 'express';
import { SearchController } from './search.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Support both GET /search and POST /search
router.get('/', SearchController.search);
router.post('/', SearchController.search);

export const searchRoutes = router;

// Knowledge routes
const knowledgeRouter = Router();
knowledgeRouter.use(authenticate);
knowledgeRouter.post('/ask', SearchController.askKnowledge);

export const knowledgeRoutes = knowledgeRouter;
