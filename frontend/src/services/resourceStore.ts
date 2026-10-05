// Resources Data Layer
// Single entry point for document (PDF/image) reads and writes.
// Talks to the backend API and transparently falls back to IndexedDB (the
// established local/demo storage for files, shared with the legacy app and the
// sync engine) when the API is unavailable.

import { resourcesApi, syncApi } from './api';
import {
  loadResourcesFromIDB,
  saveResourcesToIDB,
  removeResourceFromIDB,
  removeTopicResourcesFromIDB,
  createId,
} from './storage';
import type { StoredResource } from './storage';
import type { Resource, ResourceCreate, ResourcesListResponse } from '../types/api';

export const resourcesKey = ['resources'] as const;

/** Mirrors the legacy 20 MB cap (script.js MAX_FILE_SIZE) and the backend check. */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Same `accept` value the legacy file input uses. */
export const DOCUMENT_ACCEPT = '.pdf,image/*,application/pdf';

export type ResourcesStoreMode = 'api' | 'local';

/** Maximum resources fetched per request (backend caps `limit` at 100). */
const PAGE_SIZE = 100;
/** Safety cap so a runaway loop can never fetch forever. */
const MAX_RESOURCES = 500;

let mode: ResourcesStoreMode = 'api';

export function getResourcesMode(): ResourcesStoreMode {
  return mode;
}

export function isLocalResourcesMode(): boolean {
  return mode === 'local';
}

/** Reset to API mode and let the next request probe the backend again. */
export function resetResourcesMode(): void {
  mode = 'api';
}

interface ApiLikeError {
  status?: number;
  code?: string;
}

function shouldFallBack(error: unknown): boolean {
  const status = (error as ApiLikeError | null)?.status;
  if (typeof status !== 'number') return true;
  return status === 401 || status === 403 || status === 503 || status >= 500;
}

function switchToLocalMode(): void {
  mode = 'local';
}

function makeError(message: string, status: number, code?: string): Error {
  const error = new Error(message) as Error & ApiLikeError;
  error.status = status;
  if (code) error.code = code;
  return error;
}

// ---------------------------------------------------------------------------
// Shape normalisation
// ---------------------------------------------------------------------------

/**
 * IndexedDB is shared with the legacy app, so records can arrive in either the
 * legacy shape (`type` / numeric `size` / `addedAt`) or the raw API shape
 * (`mimeType` / string `size` / `createdAt`). Both normalise to `Resource`.
 */
export interface ResourceRecord {
  id?: string;
  userId?: string;
  topicId?: string;
  name?: string;
  mimeType?: string;
  type?: string;
  size?: string | number;
  data?: string | null;
  r2Key?: string | null;
  downloadUrl?: string | null;
  createdAt?: string;
  addedAt?: string;
}

export function normalizeResource(raw: ResourceRecord): Resource {
  const size = raw.size ?? 0;
  return {
    id: String(raw.id ?? createId()),
    userId: raw.userId ?? 'local',
    topicId: String(raw.topicId ?? ''),
    name: String(raw.name ?? 'Untitled'),
    mimeType: raw.mimeType ?? raw.type ?? 'application/octet-stream',
    size: String(size),
    data: raw.data ?? null,
    r2Key: raw.r2Key ?? null,
    downloadUrl: raw.downloadUrl ?? null,
    createdAt: raw.createdAt ?? raw.addedAt ?? new Date(0).toISOString(),
  };
}

function toStoredResource(resource: Resource): StoredResource {
  return {
    id: resource.id,
    topicId: resource.topicId,
    name: resource.name,
    type: resource.mimeType,
    size: Number.parseInt(resource.size, 10) || 0,
    data: resource.data ?? undefined,
    r2Key: resource.r2Key ?? undefined,
    downloadUrl: resource.downloadUrl ?? undefined,
    addedAt: resource.createdAt,
  };
}

export function documentKind(resource: Resource): 'pdf' | 'image' {
  if (resource.mimeType === 'application/pdf') return 'pdf';
  if (resource.mimeType.startsWith('image/')) return 'image';
  return /\.pdf$/i.test(resource.name) ? 'pdf' : 'image';
}

// ---------------------------------------------------------------------------
// Local (IndexedDB-backed) implementations
// ---------------------------------------------------------------------------

async function localList(
  params: { topicId?: string; limit?: number; offset?: number } = {}
): Promise<ResourcesListResponse> {
  const byTopic = await loadResourcesFromIDB();
  let resources: Resource[] = [];
  for (const [, list] of byTopic) {
    resources.push(...list.map((record) => normalizeResource(record as ResourceRecord)));
  }

  if (params.topicId) {
    resources = resources.filter((resource) => resource.topicId === params.topicId);
  }

  resources.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = resources.length;
  const offset = params.offset ?? 0;
  if (params.limit === undefined) {
    return { resources: resources.slice(offset), total };
  }
  return { resources: resources.slice(offset, offset + params.limit), total };
}

async function localGet(id: string): Promise<Resource> {
  const { resources } = await localList();
  const resource = resources.find((entry) => entry.id === id);
  if (!resource) throw makeError('Resource not found', 404, 'not_found');
  return resource;
}

async function persistLocalRecord(record: StoredResource): Promise<Resource> {
  await saveResourcesToIDB([record]);
  return normalizeResource(record);
}

async function localCreate(data: ResourceCreate): Promise<Resource> {
  const record: StoredResource = {
    id: createId(),
    topicId: data.topicId,
    name: data.name,
    type: data.mimeType,
    size: Number(data.size) || 0,
    data: data.data ?? undefined,
    r2Key: data.r2Key ?? undefined,
    addedAt: new Date().toISOString(),
  };
  return persistLocalRecord(record);
}

async function localCreateFromFile(file: File, topicId: string, dataUrl?: string): Promise<Resource> {
  const record: StoredResource = {
    id: createId(),
    topicId,
    name: file.name,
    type: file.type,
    size: file.size,
    data: dataUrl ?? (await fileToBase64(file)),
    addedAt: new Date().toISOString(),
  };
  return persistLocalRecord(record);
}

// ---------------------------------------------------------------------------
// Public API (API first, IndexedDB fallback)
// ---------------------------------------------------------------------------

/**
 * List resources. When `limit` is omitted every matching resource is returned
 * (fetched in pages of PAGE_SIZE) so callers never implement pagination.
 */
export async function listResources(
  params: { topicId?: string; limit?: number; offset?: number } = {}
): Promise<ResourcesListResponse> {
  if (mode === 'local') return localList(params);

  const offset = params.offset ?? 0;
  const wanted = params.limit === undefined ? MAX_RESOURCES : params.limit;

  try {
    const resources: Resource[] = [];
    let nextOffset = offset;
    let total = 0;

    while (resources.length < wanted) {
      const pageSize = Math.min(PAGE_SIZE, wanted - resources.length);
      const page = await resourcesApi.list({ ...params, limit: pageSize, offset: nextOffset });
      total = page.total;
      resources.push(...page.resources);
      nextOffset += page.resources.length;
      if (page.resources.length === 0 || nextOffset >= total) break;
    }

    // Mirror the legacy app: cache server results locally so documents stay
    // visible if the backend later becomes unreachable.
    if (!params.topicId && resources.length > 0) {
      await saveResourcesToIDB(resources.map(toStoredResource));
    }

    return { resources, total };
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localList(params);
  }
}

export async function getResource(id: string): Promise<Resource> {
  if (mode === 'local') return localGet(id);
  try {
    const resource = await resourcesApi.get(id);
    await saveResourcesToIDB([toStoredResource(resource)]);
    return resource;
  } catch (error) {
    if ((error as ApiLikeError)?.status === 404) throw error;
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localGet(id);
  }
}

export async function createResource(data: ResourceCreate): Promise<Resource> {
  if (mode === 'local') return localCreate(data);
  try {
    const { resource } = await resourcesApi.create(data);
    await saveResourcesToIDB([toStoredResource(resource)]);
    return resource;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreate(data);
  }
}

export async function deleteResource(id: string): Promise<{ success: true }> {
  if (mode === 'local') {
    await removeResourceFromIDB(id);
    return { success: true };
  }
  try {
    const result = await resourcesApi.delete(id);
    await removeResourceFromIDB(id);
    return result;
  } catch (error) {
    // Already gone on the server — treat as success and clear the local copy.
    if ((error as ApiLikeError)?.status === 404) {
      await removeResourceFromIDB(id);
      return { success: true };
    }
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    await removeResourceFromIDB(id);
    return { success: true };
  }
}

export async function deleteTopicResources(
  topicId: string
): Promise<{ success: true; deletedCount: number }> {
  if (mode === 'local') {
    await removeTopicResourcesFromIDB(topicId);
    return { success: true, deletedCount: 0 };
  }
  try {
    const result = await resourcesApi.deleteByTopic(topicId);
    await removeTopicResourcesFromIDB(topicId);
    return result;
  } catch (error) {
    if ((error as ApiLikeError)?.status === 404) {
      await removeTopicResourcesFromIDB(topicId);
      return { success: true, deletedCount: 0 };
    }
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    await removeTopicResourcesFromIDB(topicId);
    return { success: true, deletedCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Upload / open
// ---------------------------------------------------------------------------

export function validateDocumentFile(file: File): void {
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    throw makeError('Only PDF and image files are allowed', 400, 'invalid_type');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw makeError('File size exceeds 20MB limit', 400, 'file_too_large');
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/** R2/cloud upload path. Returns null when storage is not configured or the upload fails. */
export async function uploadResourceToR2(
  file: File,
  topicId: string
): Promise<{ resource: Resource; downloadUrl: string | null } | null> {
  const resourceId = createId();
  const uploadData = await syncApi.getUploadUrl(resourceId, file.name, file.type);
  if (!uploadData.uploadUrl) return null;

  const response = await fetch(uploadData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) return null;

  const { resource } = await resourcesApi.create({
    topicId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    r2Key: uploadData.key,
  });

  let downloadUrl: string | null = uploadData.publicUrl;
  if (!downloadUrl && uploadData.key) {
    try {
      const resolved = await syncApi.getDownloadUrl(uploadData.key);
      downloadUrl = resolved.downloadUrl;
    } catch {
      downloadUrl = null;
    }
  }

  const stored = toStoredResource(resource);
  stored.downloadUrl = downloadUrl ?? undefined;
  await saveResourcesToIDB([stored]);

  return { resource: { ...resource, downloadUrl }, downloadUrl };
}

/**
 * Add a document: cloud storage first (when configured), then inline base64,
 * then IndexedDB when the backend itself is unreachable.
 */
export async function addDocument(file: File, topicId: string): Promise<Resource> {
  validateDocumentFile(file);

  if (mode === 'local') {
    return localCreateFromFile(file, topicId);
  }

  // 1. Cloud storage — any failure here just means "fall through to base64".
  try {
    const uploaded = await uploadResourceToR2(file, topicId);
    if (uploaded) return uploaded.resource;
  } catch {
    // Not configured / unreachable — handled by the base64 path below.
  }

  // 2. Inline base64 (the path the legacy app used by default).
  const dataUrl = await fileToBase64(file);
  try {
    const { resource } = await resourcesApi.create({
      topicId,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: dataUrl,
    });
    await saveResourcesToIDB([toStoredResource(resource)]);
    return resource;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreateFromFile(file, topicId, dataUrl);
  }
}

export function getDocumentUrl(resource: Resource): string | null {
  return resource.downloadUrl || resource.data || null;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const match = /^data:([^;,]+)/.exec(header);
  const mimeType = match?.[1] ?? 'application/octet-stream';

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

/**
 * Open a document with the browser's built-in viewer (legacy parity).
 * Base64 payloads become a blob URL so Chrome/Firefox will render them.
 */
export function openDocument(resource: Resource): void {
  if (resource.downloadUrl) {
    window.open(resource.downloadUrl, '_blank', 'noopener');
    return;
  }

  const data = resource.data;
  if (!data) {
    throw makeError('This document has no downloadable content', 404, 'no_content');
  }

  if (!data.startsWith('data:')) {
    window.open(data, '_blank', 'noopener');
    return;
  }

  const blob = dataUrlToBlob(data);
  if (!blob) {
    window.open(data, '_blank', 'noopener');
    return;
  }

  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
