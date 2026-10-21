import { Router } from 'express';
import { CollectionsController } from './collections.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import {
  createCollectionSchema,
  updateCollectionSchema,
  addRecordingToCollectionSchema,
} from './collections.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', CollectionsController.list);
router.post('/', validateRequest({ body: createCollectionSchema }), CollectionsController.create);
router.get('/:id', CollectionsController.getById);
router.put('/:id', validateRequest({ body: updateCollectionSchema }), CollectionsController.update);
router.delete('/:id', CollectionsController.delete);
router.post(
  '/:id/recordings',
  validateRequest({ body: addRecordingToCollectionSchema }),
  CollectionsController.addRecording
);
router.delete('/:id/recordings/:recordingId', CollectionsController.removeRecording);

export const collectionRoutes = router;
