import type { AnalysisStatus, IRecording } from '../database/models/Recording.js';

export function getAnalysisState(
  recording: Pick<IRecording, 'analysisStatus' | 'analysisErrorMessage' | 'status' | 'indexStatus'>,
  hasSummary: boolean,
): { status: AnalysisStatus; error_message: string | null } {
  if (recording.analysisStatus) {
    return { status: recording.analysisStatus, error_message: recording.analysisErrorMessage || null };
  }
  // Older recordings did not persist analysis failures. Avoid presenting missing output as a success.
  if (hasSummary) return { status: 'completed', error_message: null };
  if (recording.status === 'queued' || recording.status === 'processing') {
    return { status: 'pending', error_message: null };
  }
  if (recording.indexStatus === 'indexing') return { status: 'processing', error_message: null };
  return {
    status: 'failed',
    error_message: 'AI analysis is unavailable for this recording. Check that the AI model is ready, then regenerate the analysis.',
  };
}
