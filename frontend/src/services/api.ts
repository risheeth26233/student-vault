// Student Vault API Client
// TypeScript port of the existing api.js with React integration

// Clerk type declarations
interface ClerkSession {
  getToken: () => Promise<string | null>;
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

interface Clerk {
  session: ClerkSession | null;
  user: ClerkUser | null;
  load: (publishableKey: string) => Promise<void>;
  addListener: (callback: (params: { session: ClerkSession | null; user: ClerkUser | null }) => void) => void;
  openSignIn: (options: { redirectUrl: string }) => Promise<void>;
  openSignUp: (options: { redirectUrl: string }) => Promise<void>;
  signOut: (options: { redirectUrl: string }) => Promise<void>;
}

declare global {
  interface Window {
    Clerk?: Clerk;
  }
}

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '/api';

/**
 * Get the Clerk session token for authenticated requests
 */
async function getSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Try to get token from Clerk if available
  if (window.Clerk?.session) {
    try {
      return await window.Clerk.session.getToken();
    } catch {
      // Clerk not fully loaded or no session
    }
  }
  
  // Fallback: check for stored token
  return localStorage.getItem('clerk_session_token') || null;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getSessionToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error = new Error(data.message || `API error: ${response.status}`) as Error & {
      status: number;
      code?: string;
      details?: unknown;
    };
    error.status = response.status;
    error.code = data.error;
    error.details = data.details;
    throw error;
  }
  
  return data as T;
}

/**
 * Health check - public endpoint
 */
export async function checkHealth() {
  return apiRequest<{ status: 'ok'; timestamp: string; uptime: number; version: string; environment: string }>('/health');
}

/**
 * ==================== TOPICS API ====================
 */

export const topicsApi = {
  async list(params: {
    subject?: string;
    status?: 'learning' | 'reviewing' | 'ready';
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.set('subject', params.subject);
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    
    const query = searchParams.toString();
    return apiRequest<{ topics: import('../types/api').Topic[]; total: number }>(`/topics${query ? `?${query}` : ''}`);
  },
  
  async get(id: string) {
    return apiRequest<import('../types/api').Topic>(`/topics/${id}`);
  },
  
  async create(data: import('../types/api').TopicCreate) {
    return apiRequest<import('../types/api').Topic>('/topics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(id: string, data: import('../types/api').TopicUpdate) {
    return apiRequest<import('../types/api').Topic>(`/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async updateChecklist(id: string, checklist: { understand: boolean; practice: boolean; revise: boolean }) {
    return apiRequest<import('../types/api').Topic>(`/topics/${id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify(checklist),
    });
  },
  
  async delete(id: string) {
    return apiRequest<{ success: true }>(`/topics/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== ATTENDANCE API ====================
 */

export const attendanceApi = {
  async list() {
    return apiRequest<{ subjects: import('../types/api').AttendanceSubject[]; total: number }>('/attendance');
  },
  
  async stats() {
    return apiRequest<import('../types/api').AttendanceStats>('/attendance/stats');
  },
  
  async get(id: string) {
    return apiRequest<import('../types/api').AttendanceSubject>(`/attendance/${id}`);
  },
  
  async create(data: import('../types/api').AttendanceSubjectCreate) {
    return apiRequest<{ subject: import('../types/api').AttendanceSubject }>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(id: string, data: import('../types/api').AttendanceSubjectUpdate) {
    return apiRequest<{ subject: import('../types/api').AttendanceSubject }>(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async addRecord(id: string, record: 'present' | 'absent') {
    return apiRequest<{ subject: import('../types/api').AttendanceSubject }>(`/attendance/${id}/records`, {
      method: 'POST',
      body: JSON.stringify({ record }),
    });
  },
  
  async undoRecord(id: string) {
    return apiRequest<{ subject: import('../types/api').AttendanceSubject }>(`/attendance/${id}/records/undo`, {
      method: 'DELETE',
    });
  },
  
  async updateTarget(id: string, target: number) {
    return apiRequest<{ subject: import('../types/api').AttendanceSubject }>(`/attendance/${id}/target`, {
      method: 'PUT',
      body: JSON.stringify({ target }),
    });
  },
  
  async delete(id: string) {
    return apiRequest<{ success: true }>(`/attendance/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== ASSIGNMENTS API ====================
 */

export const assignmentsApi = {
  async list(params: {
    subject?: string;
    topicId?: string;
    status?: import('../types/api').AssignmentStatus;
    priority?: import('../types/api').AssignmentPriority;
    search?: string;
    dueBefore?: string;
    dueAfter?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.set('subject', params.subject);
    if (params.topicId) searchParams.set('topicId', params.topicId);
    if (params.status) searchParams.set('status', params.status);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.search) searchParams.set('search', params.search);
    if (params.dueBefore) searchParams.set('dueBefore', params.dueBefore);
    if (params.dueAfter) searchParams.set('dueAfter', params.dueAfter);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return apiRequest<import('../types/api').AssignmentsListResponse>(`/assignments${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return apiRequest<import('../types/api').Assignment>(`/assignments/${id}`);
  },

  async create(data: import('../types/api').AssignmentCreate) {
    return apiRequest<import('../types/api').Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: import('../types/api').AssignmentUpdate) {
    return apiRequest<import('../types/api').Assignment>(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<{ success: true }>(`/assignments/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== ASSESSMENTS API (Academic Performance) ====================
 */

export const assessmentsApi = {
  async list(params: {
    subject?: string;
    topicId?: string;
    type?: import('../types/api').AssessmentType;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.set('subject', params.subject);
    if (params.topicId) searchParams.set('topicId', params.topicId);
    if (params.type) searchParams.set('type', params.type);
    if (params.search) searchParams.set('search', params.search);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return apiRequest<import('../types/api').AssessmentsListResponse>(`/assessments${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return apiRequest<import('../types/api').Assessment>(`/assessments/${id}`);
  },

  async create(data: import('../types/api').AssessmentCreate) {
    return apiRequest<import('../types/api').Assessment>('/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: import('../types/api').AssessmentUpdate) {
    return apiRequest<import('../types/api').Assessment>(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<{ success: true }>(`/assessments/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== RESOURCES API ====================
 */

export const resourcesApi = {
  async list(params: { topicId?: string; limit?: number; offset?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (params.topicId) searchParams.set('topicId', params.topicId);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    
    const query = searchParams.toString();
    return apiRequest<{ resources: import('../types/api').Resource[]; total: number }>(`/resources${query ? `?${query}` : ''}`);
  },
  
  async get(id: string) {
    return apiRequest<import('../types/api').Resource>(`/resources/${id}`);
  },
  
  async create(data: import('../types/api').ResourceCreate) {
    return apiRequest<{ resource: import('../types/api').Resource }>('/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async delete(id: string) {
    return apiRequest<{ success: true }>(`/resources/${id}`, {
      method: 'DELETE',
    });
  },
  
  async deleteByTopic(topicId: string) {
    return apiRequest<{ success: true; deletedCount: number }>(`/resources/topic/${topicId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== SYNC API ====================
 */

export const syncApi = {
  async status() {
    return apiRequest<import('../types/api').SyncStatus>('/sync/status');
  },
  
  async pull() {
    return apiRequest<import('../types/api').SyncPullResponse>('/sync/pull', { method: 'POST' });
  },
  
  async push(data: import('../types/api').SyncPushRequest) {
    return apiRequest<import('../types/api').SyncPushResponse>('/sync/push', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async getUploadUrl(resourceId: string, fileName: string, contentType: string) {
    const params = new URLSearchParams({
      resourceId,
      fileName,
      contentType,
    });
    return apiRequest<import('../types/api').R2UploadUrlResponse>(`/sync/r2/upload-url?${params}`);
  },
  
  async getDownloadUrl(key: string) {
    const params = new URLSearchParams({ key });
    return apiRequest<import('../types/api').R2DownloadUrlResponse>(`/sync/r2/download-url?${params}`);
  },
};

/**
 * ==================== IMPORT API ====================
 */

export const importApi = {
  async importV1(backup: import('../types/api').BackupV1) {
    return apiRequest<import('../types/api').ImportResponse>('/import/v1', {
      method: 'POST',
      body: JSON.stringify(backup),
    });
  },
};

/**
 * ==================== YOUTUBE API ====================
 */

export const youtubeApi = {
  async search(params: import('../types/api').YouTubeSearchOptions) {
    return apiRequest<import('../types/api').YouTubeSearchResponse>('/youtube/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  async getVideo(id: string) {
    return apiRequest<import('../types/api').YouTubeVideo | null>(`/youtube/videos/${id}`);
  },
  
  async status() {
    return apiRequest<{ configured: boolean }>('/youtube/status');
  },
};

/**
 * ==================== SEARCH API ====================
 */

export const searchApi = {
  async search(params: import('../types/api').SearchOptions) {
    return apiRequest<import('../types/api').SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  async status() {
    return apiRequest<{ configured: boolean }>('/search/status');
  },
};

/**
 * ==================== AI API ====================
 */

export const aiApi = {
  async chat(params: import('../types/api').AIChatOptions) {
    return apiRequest<import('../types/api').AIChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  async chatStream(params: import('../types/api').AIChatOptions) {
    const token = await getSessionToken();
    const response = await fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ ...params, stream: true }),
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `API error: ${response.status}`);
    }
    
    return response.body;
  },
  
  async providers() {
    return apiRequest<import('../types/api').AIProvidersResponse>('/ai/providers');
  },
};

/**
 * ==================== IMAGES API ====================
 */

export const imagesApi = {
  async generate(params: import('../types/api').ImageGenerationOptions) {
    return apiRequest<import('../types/api').ImageGenerationResponse>('/images/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  async status() {
    return apiRequest<{ configured: boolean }>('/images/status');
  },
};

/**
 * ==================== CLERK AUTH HELPERS ====================
 */

/**
 * Initialize Clerk and set up auth state listener
 */
export async function initClerk(publishableKey: string): Promise<Clerk | null> {
  if (!publishableKey) {
    console.warn('Clerk publishable key not provided');
    return null;
  }
  
  // Load Clerk script if not already loaded
  if (!window.Clerk) {
    await loadScript('https://cdn.clerk.dev/js/clerk-core.js');
  }
  
  const clerk = window.Clerk;
  if (!clerk) {
    console.error('Clerk failed to load');
    return null;
  }
  
  await clerk.load(publishableKey);
  
  // Set up auth state change listener
  clerk.addListener(({ session, user }) => {
    if (session) {
      // Store session token for API requests
      session.getToken().then(token => {
        if (token) {
          localStorage.setItem('clerk_session_token', token);
        }
      });
    } else {
      localStorage.removeItem('clerk_session_token');
    }
    
    // Dispatch custom event for app to react
    window.dispatchEvent(new CustomEvent('clerk:auth-change', { 
      detail: { session, user } 
    }));
  });
  
  return clerk;
}

/**
 * Sign in with Clerk
 */
export async function signIn(redirectUrl = '/') {
  if (window.Clerk) {
    await window.Clerk.openSignIn({ redirectUrl });
  }
}

/**
 * Sign up with Clerk
 */
export async function signUp(redirectUrl = '/') {
  if (window.Clerk) {
    await window.Clerk.openSignUp({ redirectUrl });
  }
}

/**
 * Sign out
 */
export async function signOut(redirectUrl = '/') {
  if (window.Clerk) {
    await window.Clerk.signOut({ redirectUrl });
  }
  localStorage.removeItem('clerk_session_token');
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return window.Clerk?.user || null;
}

/**
 * Get current session
 */
export function getSession() {
  return window.Clerk?.session || null;
}

/**
 * Check if user is signed in
 */
export function isSignedIn() {
  return !!window.Clerk?.session;
}

/**
 * Load external script
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Export all as default for convenience
export default {
  topics: topicsApi,
  attendance: attendanceApi,
  assignments: assignmentsApi,
  assessments: assessmentsApi,
  resources: resourcesApi,
  sync: syncApi,
  import: importApi,
  youtube: youtubeApi,
  search: searchApi,
  ai: aiApi,
  images: imagesApi,
  checkHealth,
  initClerk,
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  getSession,
  isSignedIn,
};