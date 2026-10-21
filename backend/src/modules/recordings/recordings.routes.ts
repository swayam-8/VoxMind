import { Router } from 'express';
import { RecordingsController } from './recordings.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadAudio } from '../../middleware/upload.js';
import { validateRequest } from '../../middleware/validation.js';
import {
  listRecordingsSchema,
  updateRecordingSchema,
  askRecordingSchema,
} from './recordings.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: listRecordingsSchema }), RecordingsController.list);

// Support both POST / and POST /upload for audio upload
router.post('/', uploadAudio.single('file'), RecordingsController.upload);
router.post('/upload', uploadAudio.single('file'), RecordingsController.upload);

router.get('/:id', RecordingsController.getById);
router.patch('/:id', validateRequest({ body: updateRecordingSchema }), RecordingsController.update);
router.put('/:id', validateRequest({ body: updateRecordingSchema }), RecordingsController.update);
router.delete('/:id', RecordingsController.delete);
router.post('/:id/retry', RecordingsController.retry);
router.get('/:id/audio', RecordingsController.getAudio);
router.post('/:id/ask', validateRequest({ body: askRecordingSchema }), RecordingsController.ask);

// Transcript & Analysis sub-resources
router.get('/:id/transcript', RecordingsController.getTranscript);
router.get('/:id/analysis', RecordingsController.getAnalysis);
router.get('/:id/analysis/status', RecordingsController.getAnalysisStatus);
router.post('/:id/analysis/regenerate', RecordingsController.regenerateAnalysis);
router.patch('/:id/action-items/:actionId', RecordingsController.toggleActionItem);

export const recordingRoutes = router;
