/**
 * Standardized Typed API Client for VoxMind REST API (/api/v1)
 */

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
  errors?: Record<string, string[]> | null
  meta?: {
    page: number
    per_page: number
    total: number
    pages: number
  } | null
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]> | null

  constructor(message: string, status: number, errors?: Record<string, string[]> | null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.errors = errors
  }
}

export interface ApiTranscriptSegment {
  id: string
  recording_id: string
  segment_index: number
  start_time: number
  end_time: number
  speaker: string
  text: string
  confidence: number
}

export interface ApiSummary {
  id: string
  recording_id: string
  model_name: string
  status?: "pending" | "processing" | "completed" | "failed"
  prompt_version?: string
  summary_markdown: string
  key_takeaways?: string[]
  decisions: Array<{ decision: string; context?: string; source_timestamp?: number; sourceTimestamp?: number }>
  topics: string[]
  error_message?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface ApiActionItem {
  id: string
  recording_id: string
  task: string
  assignee?: string
  due_date?: string
  completed: boolean
  source_timestamp?: number
}

export interface ApiRecording {
  id: string
  workspace_id: string
  user_id: string
  collection_id?: string | null
  collection_name?: string | null
  title: string
  filename: string
  file_size_bytes: number
  duration_seconds: number
  mime_type: string
  status: "queued" | "processing" | "transcribing" | "summarizing" | "completed" | "ready" | "failed"
  language?: string | null
  index_status?: "pending" | "indexing" | "completed" | "failed"
  indexed_at?: string | null
  index_error?: string | null
  chunk_count?: number | null
  error_message?: string | null
  created_at: string
  updated_at: string
  segments?: ApiTranscriptSegment[]
  summaries?: ApiSummary[]
  action_items?: ApiActionItem[]
}

export interface ApiSearchMatch {
  chunk_id: string
  recording_id: string
  recording_title: string
  chunk_index: number
  start_time: number
  end_time: number
  speaker: string
  text: string
  score: number
  source_segment_ids: string[]
}

export interface ApiSearchResult {
  query: string
  mode: "hybrid" | "semantic" | "keyword"
  total: number
  results: ApiSearchMatch[]
}

export interface ApiCitation {
  recording_id: string
  recording_title: string
  chunk_id: string
  start_time: number
  end_time: number
  speaker: string
  quote: string
  score: number
}

export interface ApiKnowledgeAskResult {
  answer: string
  citations: ApiCitation[]
  sufficient_evidence: boolean
  recordings_searched: string[]
  model_name: string
  error?: string
}

export interface ApiIndexStatus {
  recording_id: string
  index_status: "pending" | "indexing" | "completed" | "failed"
  indexed_at: string | null
  chunk_count: number
  error_message: string | null
}

export interface ApiCollection {
  id: string
  workspace_id: string
  name: string
  description?: string | null
  color: string
  recording_count: number
  created_at: string
  updated_at: string
  recordings?: ApiRecording[]
}

export interface ApiApiKey {
  id: string
  workspace_id: string
  user_id: string
  name: string
  key_prefix: string
  last_used_at?: string | null
  expires_at?: string | null
  is_revoked: boolean
  created_at: string
  raw_key?: string
}

export interface ApiUsageSummary {
  total_requests: number
  total_audio_seconds: number
  total_audio_hours: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  quota: {
    requests_limit: number
    audio_hours_limit: number
    tokens_limit: number
  }
  by_resource_type: Record<string, { count: number; tokens: number; duration_seconds: number }>
  by_model: Record<string, { count: number; tokens: number }>
  recent_records: Array<{
    id: string
    endpoint: string
    method: string
    resource_type: string
    model_name?: string | null
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    duration_seconds: number
    response_time_ms: number
    status_code: number
    created_at: string
  }>
}

export interface ApiDiagnostics {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  environment: string
  services: {
    database: { status: string; latency_ms?: number; message?: string }
    redis: { status: string; latency_ms?: number; message?: string }
    celery: { status: string; latency_ms?: number; active_workers?: number; worker_names?: string[]; message?: string }
    ollama: { status: string; latency_ms?: number; base_url?: string; configured_model?: string; model_available?: boolean; downloaded_models?: string[]; message?: string }
    whisper: { status: string; whisper_installed?: boolean; ffmpeg_installed?: boolean; model?: string; device?: string; compute_type?: string; message?: string }
    embedding: { status: string; model?: string; dimension?: number; device?: string; message?: string }
    vector_storage: { status: string; dialect?: string; pgvector_extension?: boolean; hnsw_index_active?: boolean; message?: string }
    storage: { status: string; path?: string; total_gb?: number; used_gb?: number; free_gb?: number; message?: string }
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1"

class ApiClient {
  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem("voxmind_access_token")
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
    return {}
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`

    const authHeader = this.getAuthHeader()

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...authHeader,
      ...(options.headers as Record<string, string>),
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json"
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const isJson = response.headers.get("content-type")?.includes("application/json")
      const data = isJson ? await response.json() : null

      if (!response.ok) {
        const errorMessage =
          data?.message || `Request failed with status ${response.status} (${response.statusText})`
        throw new ApiError(errorMessage, response.status, data?.errors)
      }

      return data as ApiResponse<T>
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Network error or server unreachable",
        0
      )
    }
  }

  // REST generic helpers
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" })
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
    })
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" })
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: isFormData ? body : JSON.stringify(body),
    })
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: isFormData ? body : JSON.stringify(body),
    })
  }

  // Authentication Domain Helpers
  async login(
    email: string,
    password: string
  ): Promise<
    ApiResponse<{
      access_token: string
      accessToken: string
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string }
    }>
  > {
    const res = await this.post<{
      access_token: string
      accessToken: string
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string }
    }>("/auth/login", { email, password })

    const token = res.data?.access_token || res.data?.accessToken
    if (token) {
      localStorage.setItem("voxmind_access_token", token)
    }
    return res
  }

  async register(data: {
    email: string
    password: string
    fullName?: string
  }): Promise<
    ApiResponse<{
      access_token: string
      accessToken: string
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string }
    }>
  > {
    const res = await this.post<{
      access_token: string
      accessToken: string
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string }
    }>("/auth/register", data)

    const token = res.data?.access_token || res.data?.accessToken
    if (token) {
      localStorage.setItem("voxmind_access_token", token)
    }
    return res
  }

  async getCurrentUser(): Promise<
    ApiResponse<{
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string } | null
    }>
  > {
    return this.get("/auth/me")
  }

  async updateProfile(data: {
    fullName?: string
    currentPassword?: string
    newPassword?: string
  }): Promise<
    ApiResponse<{
      user: { id: string; email: string; fullName: string; isActive: boolean }
      workspace: { id: string; name: string; slug: string; role: string } | null
    }>
  > {
    return this.patch("/auth/me", data)
  }

  logout(): void {
    localStorage.removeItem("voxmind_access_token")
  }

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem("voxmind_access_token"))
  }

  // Typed Domain Helpers
  async getRecordings(params?: {
    page?: number
    per_page?: number
    search?: string
    status?: string
    collection_id?: string
    sort_by?: string
    order?: string
  }): Promise<ApiResponse<ApiRecording[]>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set("page", params.page.toString())
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString())
    if (params?.search) searchParams.set("search", params.search)
    if (params?.status && params.status !== "all") searchParams.set("status", params.status)
    if (params?.collection_id && params.collection_id !== "all") searchParams.set("collection_id", params.collection_id)
    if (params?.sort_by) searchParams.set("sort_by", params.sort_by)
    if (params?.order) searchParams.set("order", params.order)

    const query = searchParams.toString()
    return this.get<ApiRecording[]>(`/recordings${query ? `?${query}` : ""}`)
  }

  async getRecording(id: string): Promise<ApiResponse<ApiRecording>> {
    return this.get<ApiRecording>(`/recordings/${id}`)
  }

  async uploadRecording(formData: FormData): Promise<ApiResponse<ApiRecording>> {
    return this.post<ApiRecording>("/recordings", formData)
  }

  async uploadRecordingWithProgress(
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<ApiResponse<ApiRecording>> {

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API_BASE}/recordings`
      xhr.open("POST", url)

      const authHeader = this.getAuthHeader()
      Object.entries(authHeader).forEach(([key, val]) => xhr.setRequestHeader(key, val))

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100))
            onProgress(percent)
          }
        }
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data)
          } else {
            reject(new ApiError(data?.message || `Upload failed with status ${xhr.status}`, xhr.status, data?.errors))
          }
        } catch {
          reject(new ApiError(`Upload failed with status ${xhr.status}`, xhr.status))
        }
      }

      xhr.onerror = () => {
        reject(new ApiError("Network error occurred during audio upload", 0))
      }

      xhr.send(formData)
    })
  }

  async getTranscript(recordingId: string): Promise<ApiResponse<{
    recording_id: string
    status: string
    error_message?: string | null
    count: number
    segments: ApiTranscriptSegment[]
  }>> {
    return this.get(`/recordings/${recordingId}/transcript`)
  }

  async retryRecording(recordingId: string): Promise<ApiResponse<{
    recording: ApiRecording
    job: { id: string; status: string; celery_task_id?: string }
  }>> {
    return this.post(`/recordings/${recordingId}/retry`)
  }

  async getJob(jobId: string): Promise<ApiResponse<{
    id: string
    recording_id: string
    celery_task_id?: string
    status: string
    engine: string
    model_name: string
    device: string
    error_message?: string
    started_at?: string
    completed_at?: string
    created_at?: string
  }>> {
    return this.get(`/jobs/${jobId}`)
  }

  async getAnalysis(recordingId: string): Promise<ApiResponse<ApiSummary & { action_items: ApiActionItem[] }>> {
    return this.get(`/recordings/${recordingId}/analysis`)
  }

  async getAnalysisStatus(recordingId: string): Promise<ApiResponse<{
    recording_id: string
    summary_id?: string
    status: string
    model_name: string
    completed_at?: string
    error_message?: string
  }>> {
    return this.get(`/recordings/${recordingId}/analysis/status`)
  }

  async regenerateAnalysis(recordingId: string): Promise<ApiResponse<ApiSummary>> {
    return this.post(`/recordings/${recordingId}/analysis/regenerate`)
  }

  async askRecording(
    recordingId: string,
    question: string
  ): Promise<ApiResponse<{
    recording_id: string
    question: string
    answer: string
    supported_by_transcript: boolean
    timestamps: number[]
    model_name: string
  }>> {
    return this.post(`/recordings/${recordingId}/ask`, { question })
  }

  async toggleActionItem(
    recordingId: string,
    actionId: string,
    completed?: boolean
  ): Promise<ApiResponse<ApiActionItem>> {
    return this.request(`/recordings/${recordingId}/action-items/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify(completed !== undefined ? { completed } : {}),
    })
  }

  async search(
    query: string,
    options: {
      limit?: number
      recording_id?: string
      recording_ids?: string[]
      mode?: "hybrid" | "semantic" | "keyword"
      min_score?: number
    } = {}
  ): Promise<ApiResponse<ApiSearchResult>> {
    return this.post("/search", { query, ...options })
  }

  async askKnowledge(
    question: string,
    options: {
      recording_ids?: string[]
      max_passages?: number
    } = {}
  ): Promise<ApiResponse<ApiKnowledgeAskResult>> {
    return this.post("/knowledge/ask", { question, ...options })
  }

  async getIndexStatus(recordingId: string): Promise<ApiResponse<ApiIndexStatus>> {
    return this.get(`/recordings/${recordingId}/index-status`)
  }

  async reindexRecording(
    recordingId: string
  ): Promise<ApiResponse<{ recording_id: string; index_status: string }>> {
    return this.post(`/recordings/${recordingId}/reindex`)
  }

  async deleteRecording(id: string): Promise<ApiResponse<{ id: string }>> {
    return this.delete<{ id: string }>(`/recordings/${id}`)
  }

  async updateRecording(
    id: string,
    data: { title?: string; collection_id?: string | null }
  ): Promise<ApiResponse<ApiRecording>> {
    return this.patch<ApiRecording>(`/recordings/${id}`, data)
  }

  // Phase 7: Collections
  async getCollections(): Promise<ApiResponse<ApiCollection[]>> {
    return this.get<ApiCollection[]>("/collections")
  }

  async getCollection(id: string): Promise<ApiResponse<ApiCollection>> {
    return this.get<ApiCollection>(`/collections/${id}`)
  }

  async createCollection(data: {
    name: string
    description?: string
    color?: string
  }): Promise<ApiResponse<ApiCollection>> {
    return this.post<ApiCollection>("/collections", data)
  }

  async updateCollection(
    id: string,
    data: { name?: string; description?: string; color?: string }
  ): Promise<ApiResponse<ApiCollection>> {
    return this.patch<ApiCollection>(`/collections/${id}`, data)
  }

  async deleteCollection(id: string): Promise<ApiResponse<{ id: string }>> {
    return this.delete<{ id: string }>(`/collections/${id}`)
  }

  async addRecordingsToCollection(
    id: string,
    recordingIds: string[]
  ): Promise<ApiResponse<{ collection_id: string; assigned_count: number }>> {
    return this.post(`/collections/${id}/recordings`, { recording_ids: recordingIds })
  }

  async removeRecordingFromCollection(
    collectionId: string,
    recordingId: string
  ): Promise<ApiResponse<{ recording_id: string; collection_id: string }>> {
    return this.delete(`/collections/${collectionId}/recordings/${recordingId}`)
  }

  // Phase 7: API Keys
  async getApiKeys(): Promise<ApiResponse<ApiApiKey[]>> {
    return this.get<ApiApiKey[]>("/api-keys")
  }

  async createApiKey(data: {
    name: string
    expires_days?: number
  }): Promise<ApiResponse<ApiApiKey>> {
    return this.post<ApiApiKey>("/api-keys", data)
  }

  async revokeApiKey(id: string): Promise<ApiResponse<{ id: string; is_revoked: boolean }>> {
    return this.delete<{ id: string; is_revoked: boolean }>(`/api-keys/${id}`)
  }

  // Phase 7: AI Token & Resource Usage
  async getUsage(): Promise<ApiResponse<ApiUsageSummary>> {
    return this.get<ApiUsageSummary>("/usage")
  }

  // Phase 7: System Diagnostics
  async getDiagnostics(): Promise<ApiResponse<ApiDiagnostics>> {
    return this.get<ApiDiagnostics>("/diagnostics")
  }

  async getHealth(): Promise<ApiResponse<{ status: string; service: string; version: string }>> {
    return this.get<{ status: string; service: string; version: string }>("/health")
  }

  async getReadiness(): Promise<ApiResponse<{ status: string; checks: Record<string, unknown> }>> {
    return this.get<{ status: string; checks: Record<string, unknown> }>("/ready")
  }
}

export const apiClient = new ApiClient()
