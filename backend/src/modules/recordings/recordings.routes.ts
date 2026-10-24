import { Router } from 'express';
import { RecordingsController } from './recordings.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { uploadAudio, validateAudioContent } from '../../middleware/upload.js';
import { validateRequest } from '../../middleware/validation.js';
import {
  listRecordingsSchema,
  updateRecordingSchema,
  askRecordingSchema,
  toggleActionSchema,
} from './recordings.schema.js';

import { authenticateAudio } from '../../middleware/audioAuth.js';
import { expensiveRateLimit, uploadRateLimit } from '../../middleware/rateLimit.js';

const router = Router();
const write = requireRole(['owner', 'admin', 'member']);
router.get('/:id/audio', authenticateAudio, RecordingsController.getAudio);

router.use(authenticate);

router.get('/', validateRequest({ query: listRecordingsSchema }), RecordingsController.list);

// Support both POST / and POST /upload for audio upload
router.post('/', write, uploadRateLimit, uploadAudio.single('file'), validateAudioContent, RecordingsController.upload);
router.post('/upload', write, uploadRateLimit, uploadAudio.single('file'), validateAudioContent, RecordingsController.upload);

router.get('/:id', RecordingsController.getById);
router.patch('/:id', write, validateRequest({ body: updateRecordingSchema }), RecordingsController.update);
router.put('/:id', write, validateRequest({ body: updateRecordingSchema }), RecordingsController.update);
router.delete('/:id', write, RecordingsController.delete);
router.post('/:id/retry', write, uploadRateLimit, RecordingsController.retry);
router.post('/:id/audio-ticket', RecordingsController.getAudioTicket);
router.post('/:id/ask', expensiveRateLimit, validateRequest({ body: askRecordingSchema }), RecordingsController.ask);
router.get('/:id/questions', RecordingsController.getQuestions);

// Transcript & Analysis sub-resources
router.get('/:id/transcript', RecordingsController.getTranscript);
router.get('/:id/analysis', RecordingsController.getAnalysis);
router.get('/:id/analysis/status', RecordingsController.getAnalysisStatus);
router.post('/:id/analysis/regenerate', write, expensiveRateLimit, RecordingsController.regenerateAnalysis);
router.patch('/:id/action-items/:actionId', write, validateRequest({ body: toggleActionSchema }), RecordingsController.toggleActionItem);

export const recordingRoutes = router;
