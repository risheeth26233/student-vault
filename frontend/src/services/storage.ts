// Storage Service
// Preserves existing localStorage + IndexedDB logic from script.js

const STORAGE_KEYS = {
  PROFILE: 'sv_profile',
  TOPICS: 'sv_topics',
  ATTENDANCE: 'sv_attendance',
  ASSIGNMENTS: 'sv_assignments',
  ASSESSMENTS: 'sv_assessments',
  CLIENT_VERSION: 'sv_clientVersion',
  CLERK_TOKEN: 'clerk_session_token',
} as const;

const DB_NAME = 'StudentVaultDB';
const DB_VERSION = 1;
const RESOURCES_STORE = 'resources';

export interface StoredResource {
  id: string;
  topicId: string;
  name: string;
  type: string;
  size: number;
  data?: string;
  r2Key?: string;
  downloadUrl?: string;
  addedAt: string;
}

// Profile
export interface StoredProfile {
  name: string;
  email?: string;
  /** True when the session was created via "Continue as guest" (local demo mode). */
  guest?: boolean;
}

export function loadProfile(): StoredProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: StoredProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } else {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
    }
  } catch (error) {
    console.error('Failed to save profile:', error);
  }
}

// Topics
export function loadTopics(): import('../types/api').Topic[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TOPICS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTopics(topics: import('../types/api').Topic[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  } catch (error) {
    console.error('Failed to save topics:', error);
  }
}

// Attendance
export function loadAttendanceSubjects(): import('../types/api').AttendanceSubject[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAttendanceSubjects(subjects: import('../types/api').AttendanceSubject[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(subjects));
  } catch (error) {
    console.error('Failed to save attendance:', error);
  }
}

// Assignments
export function loadAssignments(): import('../types/api').Assignment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: import('../types/api').Assignment[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  } catch (error) {
    console.error('Failed to save assignments:', error);
  }
}

// Assessments (academic performance records)
export function loadAssessments(): import('../types/api').Assessment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAssessments(assessments: import('../types/api').Assessment[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
  } catch (error) {
    console.error('Failed to save assessments:', error);
  }
}

// Client Version (for sync)
export function loadClientVersion(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CLIENT_VERSION);
    return data ? parseInt(data, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveClientVersion(version: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENT_VERSION, String(version));
  } catch (error) {
    console.error('Failed to save client version:', error);
  }
}

// IndexedDB for resources (file storage)
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(RESOURCES_STORE)) {
          db.createObjectStore(RESOURCES_STORE, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function loadResourcesFromIDB(): Promise<Map<string, StoredResource[]>> {
  const resourcesByTopic = new Map<string, StoredResource[]>();
  
  try {
    const db = await getDB();
    const transaction = db.transaction(RESOURCES_STORE, 'readonly');
    const store = transaction.objectStore(RESOURCES_STORE);
    const resources = await new Promise<StoredResource[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    for (const resource of resources) {
      const list = resourcesByTopic.get(resource.topicId) || [];
      list.push(resource);
      resourcesByTopic.set(resource.topicId, list);
    }
  } catch (error) {
    console.error('Failed to load resources from IndexedDB:', error);
  }
  
  return resourcesByTopic;
}

export async function saveResourcesToIDB(resources: StoredResource[]): Promise<void> {
  if (resources.length === 0) return;
  
  try {
    const db = await getDB();
    const transaction = db.transaction(RESOURCES_STORE, 'readwrite');
    const store = transaction.objectStore(RESOURCES_STORE);
    
    for (const resource of resources) {
      store.put(resource);
    }
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save resources to IndexedDB:', error);
  }
}

export async function removeResourceFromIDB(resourceId: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(RESOURCES_STORE, 'readwrite');
    const store = transaction.objectStore(RESOURCES_STORE);
    store.delete(resourceId);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to remove resource from IndexedDB:', error);
  }
}

export async function removeTopicResourcesFromIDB(topicId: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(RESOURCES_STORE, 'readwrite');
    const store = transaction.objectStore(RESOURCES_STORE);
    
    // Get all resources for this topic
    const resources = await new Promise<StoredResource[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    for (const resource of resources) {
      if (resource.topicId === topicId) {
        store.delete(resource.id);
      }
    }
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to remove topic resources from IndexedDB:', error);
  }
}

// Network status
export let isOnline = navigator.onLine;

export function initNetworkListeners(): void {
  window.addEventListener('online', () => { isOnline = true; });
  window.addEventListener('offline', () => { isOnline = false; });
}

// Utility functions
export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function defaultChecklist(): { understand: boolean; practice: boolean; revise: boolean } {
  return { understand: false, practice: false, revise: false };
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function validGoal(target: number): boolean {
  return Number.isInteger(target) && target >= 1 && target <= 100;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}