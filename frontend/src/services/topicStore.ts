// Topics Data Layer
// Single entry point for topic reads/writes.
// Talks to the backend API and transparently falls back to localStorage when the
// API is unavailable (offline, backend not running, auth not configured).
// This keeps the app fully usable in demo/local mode without duplicating hooks.

import { topicsApi } from './api';
import { loadTopics, saveTopics, createId, defaultChecklist } from './storage';
import type { Topic, TopicCreate, TopicUpdate, TopicsListResponse } from '../types/api';

export interface TopicsListParams {
  subject?: string;
  status?: 'learning' | 'reviewing' | 'ready';
  search?: string;
  limit?: number;
  offset?: number;
}

export type TopicsStoreMode = 'api' | 'local';

/** Maximum topics fetched per request (backend caps `limit` at 100). */
const PAGE_SIZE = 100;
/** Safety cap so a runaway loop can never fetch forever. */
const MAX_TOPICS = 2000;

let mode: TopicsStoreMode = 'api';

export function getTopicsMode(): TopicsStoreMode {
  return mode;
}

export function isLocalTopicsMode(): boolean {
  return mode === 'local';
}

/** Reset to API mode and let the next request probe the backend again. */
export function resetTopicsMode(): void {
  mode = 'api';
}

interface ApiLikeError {
  status?: number;
}

function shouldFallBack(error: unknown): boolean {
  const status = (error as ApiLikeError | null)?.status;
  // No status => network/parse failure => backend unreachable.
  if (typeof status !== 'number') return true;
  // Auth missing/unavailable, or server-side failure => unusable response.
  return status === 401 || status === 403 || status === 503 || status >= 500;
}

function switchToLocalMode(): void {
  mode = 'local';
}

// ---------------------------------------------------------------------------
// Local (localStorage-backed) implementations
// ---------------------------------------------------------------------------

function sortTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => {
    const aDate = a.examDate ? new Date(a.examDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.examDate ? new Date(b.examDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function localList(params: TopicsListParams): TopicsListResponse {
  let topics = loadTopics();

  if (params.subject) topics = topics.filter((t) => t.subject === params.subject);
  if (params.status) topics = topics.filter((t) => t.status === params.status);
  if (params.search) {
    const needle = params.search.toLowerCase();
    topics = topics.filter(
      (t) =>
        t.subject.toLowerCase().includes(needle) ||
        t.title.toLowerCase().includes(needle) ||
        (t.notes || '').toLowerCase().includes(needle)
    );
  }

  topics = sortTopics(topics);
  const total = topics.length;
  const offset = params.offset ?? 0;

  if (params.limit === undefined) {
    return { topics: topics.slice(offset), total };
  }
  return { topics: topics.slice(offset, offset + params.limit), total };
}

function localGet(id: string): Topic {
  const topic = loadTopics().find((t) => t.id === id);
  if (!topic) {
    const error = new Error('Topic not found') as Error & { status: number };
    error.status = 404;
    throw error;
  }
  return topic;
}

function localCreate(data: TopicCreate): Topic {
  const now = new Date().toISOString();
  const topic: Topic = {
    id: createId(),
    userId: 'local',
    subject: data.subject,
    title: data.title,
    examDate: data.examDate ?? null,
    notes: data.notes ?? '',
    status: data.status ?? 'learning',
    checklist: data.checklist ?? defaultChecklist(),
    createdAt: now,
    updatedAt: now,
  };
  saveTopics([topic, ...loadTopics()]);
  return topic;
}

function localUpdate(id: string, data: TopicUpdate): Topic {
  const topics = loadTopics();
  const index = topics.findIndex((t) => t.id === id);
  if (index === -1) {
    const error = new Error('Topic not found') as Error & { status: number };
    error.status = 404;
    throw error;
  }
  const updated: Topic = {
    ...topics[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  topics[index] = updated;
  saveTopics(topics);
  return updated;
}

function localDelete(id: string): void {
  saveTopics(loadTopics().filter((t) => t.id !== id));
}

// ---------------------------------------------------------------------------
// Public API (API first, local fallback)
// ---------------------------------------------------------------------------

/**
 * List topics matching the given filters.
 * When `limit` is omitted every matching topic is returned (fetched in pages of
 * PAGE_SIZE) so callers never have to implement pagination themselves.
 */
export async function listTopics(params: TopicsListParams = {}): Promise<TopicsListResponse> {
  if (mode === 'local') return localList(params);

  const offset = params.offset ?? 0;
  const wanted = params.limit === undefined ? MAX_TOPICS : params.limit;

  try {
    const topics: Topic[] = [];
    let nextOffset = offset;
    let total = 0;

    while (topics.length < wanted) {
      const pageSize = Math.min(PAGE_SIZE, wanted - topics.length);
      const page = await topicsApi.list({ ...params, limit: pageSize, offset: nextOffset });
      total = page.total;
      topics.push(...page.topics);
      nextOffset += page.topics.length;
      if (page.topics.length === 0 || nextOffset >= total) break;
    }

    return { topics, total };
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localList(params);
  }
}

export async function getTopic(id: string): Promise<Topic> {
  if (mode === 'local') return localGet(id);
  try {
    return await topicsApi.get(id);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localGet(id);
  }
}

export async function createTopic(data: TopicCreate): Promise<Topic> {
  if (mode === 'local') return localCreate(data);
  try {
    return await topicsApi.create(data);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreate(data);
  }
}

export async function updateTopic(id: string, data: TopicUpdate): Promise<Topic> {
  if (mode === 'local') return localUpdate(id, data);
  try {
    return await topicsApi.update(id, data);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdate(id, data);
  }
}

export async function updateTopicChecklist(
  id: string,
  checklist: Topic['checklist']
): Promise<Topic> {
  if (mode === 'local') return localUpdate(id, { checklist });
  try {
    return await topicsApi.updateChecklist(id, checklist);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdate(id, { checklist });
  }
}

export async function deleteTopic(id: string): Promise<{ success: true }> {
  if (mode === 'local') {
    localDelete(id);
    return { success: true };
  }
  try {
    return await topicsApi.delete(id);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    localDelete(id);
    return { success: true };
  }
}
