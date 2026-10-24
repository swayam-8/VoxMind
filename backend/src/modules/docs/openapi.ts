/** Public API contract. Credentials and deployment settings never belong here. */
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const envelope = (properties: object) => ({ type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties } } });
const error = { description: 'Request rejected. Inspect code and message; 429 includes Retry-After.', ...json({ type: 'object', properties: { success: { const: false }, code: { type: 'string' }, message: { type: 'string' } } }) };
const errors = { '400': error, '401': error, '403': error, '404': error, '413': error, '429': error, '503': error };
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Recording ID returned by upload or list.' };
const operation = (summary: string, description: string, extra: object = {}) => ({ summary, description, responses: { '200': { description: 'Success. Results are in data.' }, ...errors }, ...extra });
const question = { required: true, ...json({ type: 'object', required: ['question'], properties: { question: { type: 'string', minLength: 1, maxLength: 4000 } } }) };
const recording = envelope({
  id: { type: 'string' }, title: { type: 'string' },
  status: { type: 'string', enum: ['queued', 'processing', 'transcribing', 'completed', 'failed'] },
  analysis_status: { type: ['string', 'null'], enum: ['pending', 'processing', 'completed', 'failed', null] },
  analysis_error: { type: ['string', 'null'] },
  segments: { type: 'array', items: { type: 'object' } },
  summaries: { type: 'array', items: { type: 'object' } },
  action_items: { type: 'array', items: { type: 'object' } },
});
export const openapi = {
  openapi: '3.1.0',
  info: { title: 'MeetingBrief API', version: '1.0.0', description: 'Upload recordings, retrieve transcripts and insights, and ask evidence-based questions. Processing is asynchronous. All private resources belong to the key’s workspace. Read-only keys can retrieve and ask; read/write keys can also upload, edit and delete. API keys cannot manage account credentials or meeting OAuth connections.' },
  servers: [{ url: '/api/v1', description: 'Same origin as your MeetingBrief application' }],
  security: [{ ApiKey: [] }],
  components: { securitySchemes: { ApiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'mb_live_…', description: 'Create a key in Integrations. Keep it on your server. Never put it in a URL, browser bundle or public repository. X-API-Key is also supported.' } } },
  paths: {
    '/recordings': {
      get: operation('List recordings', 'Returns a paginated data array scoped to your workspace.', { parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'per_page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Literal title search.' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['queued', 'processing', 'transcribing', 'completed', 'failed'] } },
      ] }),
      post: operation('Upload a recording', 'Read/write key required. At most 100 MB with the default server configuration. Upload genuine WAV, MP3, M4A/MP4, FLAC, OGG, WebM, AAC, Opus or WMA content. A 201 response means queued; poll the returned ID.', {
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string', maxLength: 300 }, language: { type: 'string', description: 'Optional ISO language code, such as en or hi.' }, collection_id: { type: 'string' } } } } } },
        responses: { '201': { description: 'Recording queued.', ...json(recording) }, ...errors },
      }),
    },
    '/recordings/{id}': {
      parameters: [id],
      get: operation('Get recording and results', 'Poll every 3–5 seconds until status is completed. AI insights finish separately: wait for analysis_status=completed. A failed stage includes its error message. Stop polling on failure.', { responses: { '200': { description: 'Recording, transcript segments, summaries, decisions and action items.', ...json(recording) }, ...errors } }),
      patch: operation('Update a recording', 'Read/write key and workspace write permission required.', { requestBody: { required: true, ...json({ type: 'object', properties: { title: { type: 'string', maxLength: 300 }, collection_id: { type: ['string', 'null'] } } }) } }),
      delete: operation('Delete a recording', 'Read/write key required. Deletes the recording, transcript, insights and saved recording questions. This cannot be undone.'),
    },
    '/recordings/{id}/transcript': { parameters: [id], get: operation('Get the transcript', 'Returns data.segments with start_time, end_time, speaker, text and confidence. The list remains empty while transcription is pending.') },
    '/recordings/{id}/analysis': { parameters: [id], get: operation('Get summary, decisions and actions', 'Returns summary_markdown, key_takeaways, decisions, topics and action_items. A 404 means no analysis has been saved yet; check the status endpoint.') },
    '/recordings/{id}/analysis/status': { parameters: [id], get: operation('Check insight progress', 'Returns status: pending, processing, completed or failed, plus error_message when available.') },
    '/recordings/{id}/analysis/regenerate': { parameters: [id], post: operation('Regenerate insights', 'Read/write key required. A transcript must exist. Repeated requests while analysis is running do not create duplicate jobs.') },
    '/recordings/{id}/ask': { parameters: [id], post: operation('Ask about a recording', 'Returns answer, supported_by_transcript, timestamps and model_name. Saves the question and answer for the key owner. A read-only key may ask. Verify the support flag before relying on an answer.', { requestBody: question }) },
    '/recordings/{id}/questions': { parameters: [id], get: operation('Read saved questions and answers', 'Returns only the key owner’s conversation in this workspace, in chronological order.') },
    '/recordings/{id}/audio': { parameters: [id], get: operation('Stream audio', 'Authorize with your API key header. Byte ranges support audio seeking. Browser players can use a recording-specific ticket instead.', { responses: { '200': { description: 'Audio bytes.' }, '206': { description: 'Requested byte range.' }, '416': { description: 'Range unavailable.' }, ...errors } }) },
    '/recordings/{id}/audio-ticket': { parameters: [id], post: operation('Create browser playback access', 'Returns ticket and expires_in=900. Use /recordings/{id}/audio?ticket=… for this recording only. It grants no access to other endpoints and is invalid after expiry, membership removal or credential revocation.') },
    '/recordings/{id}/action-items/{actionId}': { parameters: [id, { name: 'actionId', in: 'path', required: true, schema: { type: 'string' } }], patch: operation('Complete or reopen an action', 'Read/write key required.', { requestBody: { required: true, ...json({ type: 'object', required: ['completed'], properties: { completed: { type: 'boolean' } } }) } }) },
    '/search': { post: operation('Search your workspace', 'Returns ranked transcript passages with recording IDs, timestamps and scores. Filters never cross workspace boundaries.', { requestBody: { required: true, ...json({ type: 'object', required: ['query'], properties: { query: { type: 'string', maxLength: 4000 }, limit: { type: 'integer', minimum: 1, maximum: 50 }, collection_id: { type: 'string' } } }) } }) },
    '/knowledge/ask': { post: operation('Ask across recordings', 'Returns answer, citations, sources and recordings_searched from your workspace. A read-only key may ask.', { requestBody: question }) },
    '/collections': {
      get: operation('List collections', 'Returns the workspace’s recording collections.'),
      post: operation('Create a collection', 'Read/write key required.', { requestBody: { required: true, ...json({ type: 'object', required: ['name'], properties: { name: { type: 'string', maxLength: 150 }, description: { type: 'string', maxLength: 2000 }, color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } } }) } }),
    },
    '/usage': { get: operation('Read usage', 'Returns recorded transcription and AI activity. These reporting totals do not represent a paid subscription or a billing entitlement.') },
  },
};
