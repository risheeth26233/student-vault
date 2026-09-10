// Student Vault API Client
// Provides typed access to the backend API with Clerk authentication

const API_BASE = (typeof process !== 'undefined' && process.env?.VITE_API_BASE) || '/api';

/**
 * Get the Clerk session token for authenticated requests
 */
async function getSessionToken() {
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
async function apiRequest(endpoint, options = {}) {
  const token = await getSessionToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error = new Error(data.message || `API error: ${response.status}`);
    error.status = response.status;
    error.code = data.error;
    error.details = data.details;
    throw error;
  }
  
  return data;
}

/**
 * Health check - public endpoint
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * ==================== TOPICS API ====================
 */

export const topicsApi = {
  // List topics with optional filters
  async list(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.set('subject', params.subject);
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.offset) searchParams.set('offset', params.offset);
    
    const query = searchParams.toString();
    return apiRequest(`/topics${query ? `?${query}` : ''}`);
  },
  
  // Get single topic
  async get(id) {
    return apiRequest(`/topics/${id}`);
  },
  
  // Create topic
  async create(data) {
    return apiRequest('/topics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Update topic
  async update(id, data) {
    return apiRequest(`/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Update checklist only
  async updateChecklist(id, checklist) {
    return apiRequest(`/topics/${id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify(checklist),
    });
  },
  
  // Delete topic
  async delete(id) {
    return apiRequest(`/topics/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== ATTENDANCE API ====================
 */

export const attendanceApi = {
  // List all attendance subjects with records
  async list() {
    return apiRequest('/attendance');
  },
  
  // Get overall statistics
  async stats() {
    return apiRequest('/attendance/stats');
  },
  
  // Get single subject
  async get(id) {
    return apiRequest(`/attendance/${id}`);
  },
  
  // Create subject
  async create(data) {
    return apiRequest('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Update subject
  async update(id, data) {
    return apiRequest(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Add record (present/absent)
  async addRecord(id, record) {
    return apiRequest(`/attendance/${id}/records`, {
      method: 'POST',
      body: JSON.stringify({ record }),
    });
  },
  
  // Undo last record
  async undoRecord(id) {
    return apiRequest(`/attendance/${id}/records/undo`, {
      method: 'DELETE',
    });
  },
  
  // Update target
  async updateTarget(id, target) {
    return apiRequest(`/attendance/${id}/target`, {
      method: 'PUT',
      body: JSON.stringify({ target }),
    });
  },
  
  // Delete subject
  async delete(id) {
    return apiRequest(`/attendance/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== RESOURCES API ====================
 */

export const resourcesApi = {
  // List resources
  async list(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.topicId) searchParams.set('topicId', params.topicId);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.offset) searchParams.set('offset', params.offset);
    
    const query = searchParams.toString();
    return apiRequest(`/resources${query ? `?${query}` : ''}`);
  },
  
  // Get single resource
  async get(id) {
    return apiRequest(`/resources/${id}`);
  },
  
  // Create resource (with base64 data or R2 key)
  async create(data) {
    return apiRequest('/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Delete resource
  async delete(id) {
    return apiRequest(`/resources/${id}`, {
      method: 'DELETE',
    });
  },
  
  // Delete all resources for a topic
  async deleteByTopic(topicId) {
    return apiRequest(`/resources/topic/${topicId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * ==================== SYNC API ====================
 */

export const syncApi = {
  // Get sync status
  async status() {
    return apiRequest('/sync/status');
  },
  
  // Pull data from server
  async pull() {
    return apiRequest('/sync/pull', { method: 'POST' });
  },
  
  // Push data to server
  async push(data) {
    return apiRequest('/sync/push', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Get R2 upload URL
  async getUploadUrl(resourceId, fileName, contentType) {
    const params = new URLSearchParams({
      resourceId,
      fileName,
      contentType,
    });
    return apiRequest(`/sync/r2/upload-url?${params}`);
  },
  
  // Get R2 download URL
  async getDownloadUrl(key) {
    const params = new URLSearchParams({ key });
    return apiRequest(`/sync/r2/download-url?${params}`);
  },
};

/**
 * ==================== IMPORT API ====================
 */

export const importApi = {
  // Import backup v1
  async importV1(backup) {
    return apiRequest('/import/v1', {
      method: 'POST',
      body: JSON.stringify(backup),
    });
  },
};

/**
 * ==================== YOUTUBE API ====================
 */

export const youtubeApi = {
  // Search videos
  async search(params) {
    return apiRequest('/youtube/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  // Get video details
  async getVideo(id) {
    return apiRequest(`/youtube/videos/${id}`);
  },
  
  // Check service status
  async status() {
    return apiRequest('/youtube/status');
  },
};

/**
 * ==================== SEARCH API ====================
 */

export const searchApi = {
  // Search web
  async search(params) {
    return apiRequest('/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  // Check service status
  async status() {
    return apiRequest('/search/status');
  },
};

/**
 * ==================== AI API ====================
 */

export const aiApi = {
  // Chat completion
  async chat(params) {
    return apiRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  // Streaming chat (returns ReadableStream)
  async chatStream(params) {
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
  
  // List providers
  async providers() {
    return apiRequest('/ai/providers');
  },
};

/**
 * ==================== IMAGES API ====================
 */

export const imagesApi = {
  // Generate image
  async generate(params) {
    return apiRequest('/images/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  // Check service status
  async status() {
    return apiRequest('/images/status');
  },
};

/**
 * ==================== CLERK AUTH HELPERS ====================
 */

/**
 * Initialize Clerk and set up auth state listener
 */
export async function initClerk(publishableKey) {
  if (!publishableKey) {
    console.warn('Clerk publishable key not provided');
    return null;
  }
  
  // Load Clerk script if not already loaded
  if (!window.Clerk) {
    await loadScript('https://cdn.clerk.dev/js/clerk-core.js');
  }
  
  await window.Clerk.load(publishableKey);
  
  // Set up auth state change listener
  window.Clerk.addListener(({ session, user }) => {
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
  
  return window.Clerk;
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
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }
}

// Export all as default for convenience
export default {
  topics: topicsApi,
  attendance: attendanceApi,
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