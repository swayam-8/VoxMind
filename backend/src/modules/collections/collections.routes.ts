import { Router } from 'express';
import { CollectionsController } from './collections.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import {
  createCollectionSchema,
  updateCollectionSchema,
  addRecordingToCollectionSchema,
} from './collections.schema.js';

const router = Router();

router.use(authenticate);
const write = requireRole(['owner', 'admin', 'member']);

router.get('/', CollectionsController.list);
router.post('/', write, validateRequest({ body: createCollectionSchema }), CollectionsController.create);
router.get('/:id', CollectionsController.getById);
router.put('/:id', write, validateRequest({ body: updateCollectionSchema }), CollectionsController.update);
router.delete('/:id', write, CollectionsController.delete);
router.post(
  '/:id/recordings', write,
  validateRequest({ body: addRecordingToCollectionSchema }),
  CollectionsController.addRecording
);
router.delete('/:id/recordings/:recordingId', write, CollectionsController.removeRecording);

export const collectionRoutes = router;
