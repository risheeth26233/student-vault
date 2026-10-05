import { useQuery, useMutation } from '@tanstack/react-query';
import { syncApi, importApi } from '../services/api';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, BackupV1 } from '../types/api';
import { loadClientVersion, saveClientVersion, loadProfile, loadTopics, loadAttendanceSubjects, loadResourcesFromIDB } from '../services/storage';

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => syncApi.status(),
    staleTime: 1000 * 60 * 1,
  });
}

export function useSyncPull() {
  return useMutation({
    mutationFn: () => syncApi.pull(),
  });
}

export function useSyncPush() {
  return useMutation({
    mutationFn: (data: SyncPushRequest) => syncApi.push(data),
  });
}

export function useImportBackup() {
  return useMutation({
    mutationFn: (backup: BackupV1) => importApi.importV1(backup),
  });
}

export async function buildPushPayload(): Promise<SyncPushRequest> {
  const clientVersion = loadClientVersion();
  const profile = loadProfile();
  const topics = loadTopics();
  const attendanceSubjects = loadAttendanceSubjects();
  const resourcesByTopic = await loadResourcesFromIDB();
  
  // Flatten resources
  const resources: SyncPushRequest['resources'] = [];
  for (const [, topicResources] of resourcesByTopic) {
    for (const resource of topicResources) {
      resources.push({
        id: resource.id,
        topicId: resource.topicId,
        name: resource.name,
        mimeType: resource.type,
        size: String(resource.size),
        r2Key: resource.r2Key ?? null,
        data: resource.data ?? null,
        downloadUrl: resource.downloadUrl ?? null,
        createdAt: resource.addedAt,
        userId: '', // Will be filled by server
      });
    }
  }
  
  return {
    profile: profile ? { name: profile.name } : null,
    topics: topics.map((t) => ({
      ...t,
      _deleted: false,
    })),
    attendanceSubjects: attendanceSubjects.map((a) => ({
      ...a,
      _deleted: false,
    })),
    resources,
    clientVersion,
  };
}

export async function performFullSync(
  onProgress?: (step: string) => void
): Promise<{ pull: SyncPullResponse; push: SyncPushResponse }> {
  // Pull first
  onProgress?.('Pulling data from server...');
  const pullResponse = await syncApi.pull();
  
  // Update local storage with pulled data
  onProgress?.('Updating local storage...');
  if (pullResponse.profile) {
    localStorage.setItem('sv_profile', JSON.stringify(pullResponse.profile));
  }
  
  // Store topics
  localStorage.setItem('sv_topics', JSON.stringify(pullResponse.topics));
  
  // Store attendance
  localStorage.setItem('sv_attendance', JSON.stringify(pullResponse.attendanceSubjects));
  
  // Store resources in IndexedDB
  const { saveResourcesToIDB } = await import('../services/storage');
  const resourcesToStore = pullResponse.resources.map((r) => ({
    id: r.id,
    topicId: r.topicId,
    name: r.name,
    type: r.mimeType,
    size: parseInt(r.size, 10),
    r2Key: r.r2Key ?? undefined,
    downloadUrl: r.downloadUrl ?? undefined,
    addedAt: r.createdAt,
  }));
  await saveResourcesToIDB(resourcesToStore);
  
  // Update client version
  saveClientVersion(pullResponse.serverVersion);
  
  // Invalidate queries
  // Invalidate queries (will be handled by the caller using the actual queryClient)
  // queryClient.invalidateQueries({ queryKey: ['topics'] });
  // queryClient.invalidateQueries({ queryKey: ['attendance'] });
  // queryClient.invalidateQueries({ queryKey: ['resources'] });
  
  onProgress?.('Pull complete');
  
  return { 
    pull: pullResponse, 
    push: { 
      success: true, 
      message: '', 
      serverVersion: pullResponse.serverVersion, 
      stats: {
        topicsCreated: 0,
        topicsUpdated: 0,
        topicsDeleted: 0,
        attendanceCreated: 0,
        attendanceUpdated: 0,
        attendanceDeleted: 0,
        resourcesCreated: 0,
        resourcesUpdated: 0,
        resourcesDeleted: 0,
      }
    } 
  };
}

export async function performPushSync(
  onProgress?: (step: string) => void
): Promise<SyncPushResponse> {
  onProgress?.('Building push payload...');
  const payload = await buildPushPayload();
  
  onProgress?.('Pushing changes to server...');
  const response = await syncApi.push(payload);
  
  if (response.success) {
    saveClientVersion(response.serverVersion);
    onProgress?.('Push complete');
  } else if (response.conflicts && response.conflicts.length > 0) {
    onProgress?.(`Conflicts detected: ${response.conflicts.length}`);
  }
  
  return response;
}

export function createBackupV1(): BackupV1 {
  const profile = loadProfile();
  const topics = loadTopics();
  const attendanceSubjects = loadAttendanceSubjects();
  
  // Note: resources need to be loaded from IndexedDB asynchronously
  // This is a synchronous version for immediate use
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ? { name: profile.name } : null,
    topics,
    attendanceSubjects,
    resources: [], // Will be populated async
  };
}

export async function createFullBackupV1(): Promise<BackupV1> {
  const profile = loadProfile();
  const topics = loadTopics();
  const attendanceSubjects = loadAttendanceSubjects();
  const resourcesByTopic = await loadResourcesFromIDB();
  
  const resources: BackupV1['resources'] = [];
  for (const [, topicResources] of resourcesByTopic) {
    for (const resource of topicResources) {
      resources.push({
        id: resource.id,
        topicId: resource.topicId,
        name: resource.name,
        mimeType: resource.type,
        size: String(resource.size),
        r2Key: resource.r2Key ?? null,
        data: resource.data ?? null,
        downloadUrl: resource.downloadUrl ?? null,
        createdAt: resource.addedAt,
        userId: '', // Will be filled by server
      });
    }
  }
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ? { name: profile.name } : null,
    topics,
    attendanceSubjects,
    resources,
  };
}

export function downloadBackup(backup: BackupV1) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `student-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<BackupV1> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result as string);
        if (backup.version !== 1) {
          reject(new Error(`Unsupported backup version: ${backup.version}`));
          return;
        }
        resolve(backup);
      } catch {
        reject(new Error('Invalid backup file format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}