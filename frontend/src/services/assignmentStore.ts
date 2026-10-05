// Assignments Data Layer
// Single entry point for assignment reads/writes.
// Talks to the backend API and transparently falls back to localStorage when the
// API is unavailable (offline, backend not running, auth not configured) — the
// same pattern used by the topics, attendance and resources stores.

import { assignmentsApi } from './api';
import { loadAssignments, saveAssignments, createId } from './storage';
import type {
  Assignment,
  AssignmentCreate,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentUpdate,
  AssignmentsListResponse,
} from '../types/api';

export type AssignmentsStoreMode = 'api' | 'local';

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['pending', 'in_progress', 'completed'];
const ASSIGNMENT_PRIORITIES: AssignmentPriority[] = ['low', 'medium', 'high'];

let mode: AssignmentsStoreMode = 'api';

export function getAssignmentsMode(): AssignmentsStoreMode {
  return mode;
}

export function isLocalAssignmentsMode(): boolean {
  return mode === 'local';
}

/** Reset to API mode and let the next request probe the backend again. */
export function resetAssignmentsMode(): void {
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
// Normalisation (defensive reads from localStorage)
// ---------------------------------------------------------------------------

function normalizeStatus(value: unknown): AssignmentStatus {
  return ASSIGNMENT_STATUSES.includes(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : 'pending';
}

function normalizePriority(value: unknown): AssignmentPriority {
  return ASSIGNMENT_PRIORITIES.includes(value as AssignmentPriority)
    ? (value as AssignmentPriority)
    : 'medium';
}

function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeAssignment(raw: unknown): Assignment | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  if (!title) return null;
  const subject = typeof source.subject === 'string' ? source.subject.trim() : '';
  if (!subject) return null;

  const now = new Date().toISOString();
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId(),
    userId: typeof source.userId === 'string' && source.userId ? source.userId : 'local',
    title,
    description: typeof source.description === 'string' ? source.description : '',
    subject,
    topicId: typeof source.topicId === 'string' && source.topicId ? source.topicId : null,
    dueDate: normalizeDueDate(source.dueDate),
    status: normalizeStatus(source.status),
    priority: normalizePriority(source.priority),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
  };
}

function loadLocalAssignments(): Assignment[] {
  const raw = loadAssignments() as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeAssignment)
    .filter((assignment): assignment is Assignment => assignment !== null);
}

function saveLocalAssignments(assignments: Assignment[]): void {
  saveAssignments(assignments);
}

function assignmentNotFound(): never {
  const error = new Error('Assignment not found') as Error & { status: number };
  error.status = 404;
  throw error;
}

function invalidFieldError(message: string): never {
  const error = new Error(message) as Error & { status: number };
  error.status = 400;
  throw error;
}

function validateInput(data: AssignmentCreate | AssignmentUpdate): void {
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) invalidFieldError('Enter a title for the assignment.');
    if (title.length > 120) invalidFieldError('Title is limited to 120 characters.');
  }
  if (data.subject !== undefined && !data.subject.trim()) {
    invalidFieldError('Enter a subject for the assignment.');
  }
  if (data.description !== undefined && data.description.length > 2000) {
    invalidFieldError('Description is limited to 2000 characters.');
  }
}

// ---------------------------------------------------------------------------
// Local (localStorage-backed) implementations
// ---------------------------------------------------------------------------

function sortAssignments(assignments: Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function localList(): AssignmentsListResponse {
  const assignments = sortAssignments(loadLocalAssignments());
  return { assignments, total: assignments.length };
}

function localGet(id: string): Assignment {
  const assignment = loadLocalAssignments().find((item) => item.id === id);
  if (!assignment) assignmentNotFound();
  return assignment;
}

function localCreate(data: AssignmentCreate): Assignment {
  validateInput(data);

  const now = new Date().toISOString();
  const assignment: Assignment = {
    id: createId(),
    userId: 'local',
    title: data.title.trim(),
    description: data.description ?? '',
    subject: data.subject.trim(),
    topicId: data.topicId ?? null,
    dueDate: normalizeDueDate(data.dueDate),
    status: data.status ?? 'pending',
    priority: data.priority ?? 'medium',
    createdAt: now,
    updatedAt: now,
  };
  saveLocalAssignments([assignment, ...loadLocalAssignments()]);
  return assignment;
}

function localUpdate(id: string, data: AssignmentUpdate): Assignment {
  validateInput(data);

  const assignments = loadLocalAssignments();
  const index = assignments.findIndex((item) => item.id === id);
  if (index === -1) assignmentNotFound();

  const updated: Assignment = {
    ...assignments[index],
    ...(data.title !== undefined ? { title: data.title.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
    ...(data.topicId !== undefined ? { topicId: data.topicId } : {}),
    ...(data.dueDate !== undefined ? { dueDate: normalizeDueDate(data.dueDate) } : {}),
    ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}),
    ...(data.priority !== undefined ? { priority: normalizePriority(data.priority) } : {}),
    updatedAt: new Date().toISOString(),
  };
  assignments[index] = updated;
  saveLocalAssignments(assignments);
  return updated;
}

function localDelete(id: string): { success: true } {
  saveLocalAssignments(loadLocalAssignments().filter((item) => item.id !== id));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Local cache maintenance while running in API mode
// ---------------------------------------------------------------------------

function upsertCachedAssignment(assignment: Assignment): void {
  const assignments = loadLocalAssignments();
  const index = assignments.findIndex((item) => item.id === assignment.id);
  if (index === -1) {
    saveLocalAssignments([assignment, ...assignments]);
  } else {
    assignments[index] = assignment;
    saveLocalAssignments(assignments);
  }
}

function removeCachedAssignment(id: string): void {
  saveLocalAssignments(loadLocalAssignments().filter((item) => item.id !== id));
}

// ---------------------------------------------------------------------------
// Public API (API first, local fallback)
// ---------------------------------------------------------------------------

export async function listAssignments(
  params: Parameters<typeof assignmentsApi.list>[0] = {}
): Promise<AssignmentsListResponse> {
  if (mode === 'local') return localList();
  try {
    const response = await assignmentsApi.list(params);
    // Cache the authoritative copy so the offline fallback stays fresh.
    saveAssignments(response.assignments);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localList();
  }
}

export async function getAssignment(id: string): Promise<Assignment> {
  if (mode === 'local') return localGet(id);
  try {
    return await assignmentsApi.get(id);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localGet(id);
  }
}

export async function createAssignment(data: AssignmentCreate): Promise<Assignment> {
  if (mode === 'local') return localCreate(data);
  try {
    const assignment = await assignmentsApi.create(data);
    upsertCachedAssignment(assignment);
    return assignment;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreate(data);
  }
}

export async function updateAssignment(id: string, data: AssignmentUpdate): Promise<Assignment> {
  if (mode === 'local') return localUpdate(id, data);
  try {
    const assignment = await assignmentsApi.update(id, data);
    upsertCachedAssignment(assignment);
    return assignment;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdate(id, data);
  }
}

export async function deleteAssignment(id: string): Promise<{ success: true }> {
  if (mode === 'local') return localDelete(id);
  try {
    const response = await assignmentsApi.delete(id);
    removeCachedAssignment(id);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localDelete(id);
  }
}
