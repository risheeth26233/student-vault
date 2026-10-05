// Attendance Data Layer
// Single entry point for attendance reads/writes.
// Talks to the backend API and transparently falls back to localStorage when the
// API is unavailable (offline, backend not running, auth not configured).
// Also normalises records written by the legacy vanilla app (plain strings)
// into the canonical { id, record, createdAt } shape used by the backend.

import { attendanceApi } from './api';
import { loadAttendanceSubjects, saveAttendanceSubjects, createId, validGoal } from './storage';
import type {
  AttendanceRecord,
  AttendanceStats,
  AttendanceSubject,
  AttendanceSubjectCreate,
  AttendanceSubjectUpdate,
  AttendanceSubjectsListResponse,
} from '../types/api';

export type AttendanceStoreMode = 'api' | 'local';

let mode: AttendanceStoreMode = 'api';

export function getAttendanceMode(): AttendanceStoreMode {
  return mode;
}

export function isLocalAttendanceMode(): boolean {
  return mode === 'local';
}

/** Reset to API mode and let the next request probe the backend again. */
export function resetAttendanceMode(): void {
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
// Normalisation (legacy localStorage shape -> backend shape)
// ---------------------------------------------------------------------------

function normalizeRecord(raw: unknown, subjectId: string, index: number): AttendanceRecord | null {
  const now = new Date().toISOString();
  // Legacy app stored records as plain strings: "present" | "absent".
  if (typeof raw === 'string') {
    if (raw !== 'present' && raw !== 'absent') return null;
    return { id: `${subjectId}-r${index}-${createId()}`, record: raw, createdAt: now };
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as Partial<AttendanceRecord>;
    if (candidate.record === 'present' || candidate.record === 'absent') {
      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId(),
        record: candidate.record,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
      };
    }
  }
  return null;
}

function normalizeSubject(raw: unknown): AttendanceSubject | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) return null;
  const id = typeof source.id === 'string' && source.id ? source.id : createId();
  const rawTarget = Number(source.target);
  const target = validGoal(rawTarget) ? rawTarget : 75;
  const now = new Date().toISOString();
  const rawRecords = Array.isArray(source.records) ? source.records : [];
  const records = rawRecords
    .map((record, index) => normalizeRecord(record, id, index))
    .filter((record): record is AttendanceRecord => record !== null);
  return {
    id,
    userId: typeof source.userId === 'string' && source.userId ? source.userId : 'local',
    name,
    target,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
    records,
  };
}

/**
 * Read localStorage and normalise whatever is there. Normalisation happens in
 * memory only — the stored payload is left untouched until the next write, so
 * the legacy app can still read its own format until this app first mutates it.
 */
function loadLocalSubjects(): AttendanceSubject[] {
  const raw = loadAttendanceSubjects() as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSubject)
    .filter((subject): subject is AttendanceSubject => subject !== null);
}

function saveLocalSubjects(subjects: AttendanceSubject[]): void {
  saveAttendanceSubjects(subjects);
}

function subjectNotFound(): never {
  const error = new Error('Subject not found') as Error & { status: number };
  error.status = 404;
  throw error;
}

function invalidGoalError(): never {
  const error = new Error('The goal must be a whole number from 1 to 100.') as Error & { status: number };
  error.status = 400;
  throw error;
}

function duplicateNameError(): never {
  const error = new Error('That subject is already in your list.') as Error & { status: number };
  error.status = 409;
  throw error;
}

// ---------------------------------------------------------------------------
// Local (localStorage-backed) implementations
// ---------------------------------------------------------------------------

function localList(): AttendanceSubjectsListResponse {
  const subjects = loadLocalSubjects();
  return { subjects, total: subjects.length };
}

function localGet(id: string): AttendanceSubject {
  const subject = loadLocalSubjects().find((item) => item.id === id);
  if (!subject) subjectNotFound();
  return subject;
}

function localStats(): AttendanceStats {
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalClasses = 0;

  const subjects = loadLocalSubjects();
  for (const subject of subjects) {
    for (const record of subject.records) {
      if (record.record === 'present') totalPresent++;
      else totalAbsent++;
    }
    totalClasses += subject.records.length;
  }

  const overallPercentage =
    totalClasses === 0 ? '--' : `${((totalPresent * 100) / totalClasses).toFixed(1)}%`;

  return {
    totalPresent,
    totalAbsent,
    totalClasses,
    overallPercentage,
    subjectsTracked: subjects.length,
  };
}

function localCreate(data: AttendanceSubjectCreate): AttendanceSubject {
  const name = data.name.trim();
  if (!name) {
    const error = new Error('Enter a subject name.') as Error & { status: number };
    error.status = 400;
    throw error;
  }
  const target = data.target ?? 75;
  if (!validGoal(target)) invalidGoalError();

  const subjects = loadLocalSubjects();
  if (subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
    duplicateNameError();
  }

  const now = new Date().toISOString();
  const subject: AttendanceSubject = {
    id: createId(),
    userId: 'local',
    name,
    target,
    createdAt: now,
    updatedAt: now,
    records: [],
  };
  saveLocalSubjects([subject, ...subjects]);
  return subject;
}

function localUpdate(id: string, data: AttendanceSubjectUpdate): AttendanceSubject {
  if (data.target !== undefined && !validGoal(data.target)) invalidGoalError();
  const subjects = loadLocalSubjects();
  const index = subjects.findIndex((item) => item.id === id);
  if (index === -1) subjectNotFound();

  const updated: AttendanceSubject = {
    ...subjects[index],
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.target !== undefined ? { target: data.target } : {}),
    updatedAt: new Date().toISOString(),
  };
  subjects[index] = updated;
  saveLocalSubjects(subjects);
  return updated;
}

function localDelete(id: string): { success: true } {
  saveLocalSubjects(loadLocalSubjects().filter((item) => item.id !== id));
  return { success: true };
}

function localAddRecord(id: string, record: 'present' | 'absent'): AttendanceSubject {
  const subjects = loadLocalSubjects();
  const index = subjects.findIndex((item) => item.id === id);
  if (index === -1) subjectNotFound();

  const updated: AttendanceSubject = {
    ...subjects[index],
    records: [
      ...subjects[index].records,
      { id: createId(), record, createdAt: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
  subjects[index] = updated;
  saveLocalSubjects(subjects);
  return updated;
}

function localUndoRecord(id: string): AttendanceSubject {
  const subjects = loadLocalSubjects();
  const index = subjects.findIndex((item) => item.id === id);
  if (index === -1) subjectNotFound();
  if (subjects[index].records.length === 0) return subjects[index];

  const updated: AttendanceSubject = {
    ...subjects[index],
    records: subjects[index].records.slice(0, -1),
    updatedAt: new Date().toISOString(),
  };
  subjects[index] = updated;
  saveLocalSubjects(subjects);
  return updated;
}

function localUpdateTarget(id: string, target: number): AttendanceSubject {
  return localUpdate(id, { target });
}

// ---------------------------------------------------------------------------
// Local cache maintenance while running in API mode
// ---------------------------------------------------------------------------

function upsertCachedSubject(subject: AttendanceSubject): void {
  const subjects = loadLocalSubjects();
  const index = subjects.findIndex((item) => item.id === subject.id);
  if (index === -1) {
    saveLocalSubjects([subject, ...subjects]);
  } else {
    subjects[index] = subject;
    saveLocalSubjects(subjects);
  }
}

function removeCachedSubject(id: string): void {
  saveLocalSubjects(loadLocalSubjects().filter((item) => item.id !== id));
}

// ---------------------------------------------------------------------------
// Public API (API first, local fallback)
// ---------------------------------------------------------------------------

export async function listAttendance(): Promise<AttendanceSubjectsListResponse> {
  if (mode === 'local') return localList();
  try {
    const response = await attendanceApi.list();
    // Cache the authoritative copy so the offline fallback stays fresh
    // (the legacy app did the same after pulling from the API).
    saveAttendanceSubjects(response.subjects);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localList();
  }
}

export async function getAttendanceStats(): Promise<AttendanceStats> {
  if (mode === 'local') return localStats();
  try {
    return await attendanceApi.stats();
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localStats();
  }
}

export async function getAttendance(id: string): Promise<AttendanceSubject> {
  if (mode === 'local') return localGet(id);
  try {
    return await attendanceApi.get(id);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localGet(id);
  }
}

export async function createAttendanceSubject(data: AttendanceSubjectCreate): Promise<AttendanceSubject> {
  if (mode === 'local') return localCreate(data);
  try {
    const { subject } = await attendanceApi.create(data);
    upsertCachedSubject(subject);
    return subject;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreate(data);
  }
}

export async function updateAttendanceSubject(
  id: string,
  data: AttendanceSubjectUpdate
): Promise<AttendanceSubject> {
  if (mode === 'local') return localUpdate(id, data);
  try {
    const { subject } = await attendanceApi.update(id, data);
    upsertCachedSubject(subject);
    return subject;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdate(id, data);
  }
}

export async function addAttendanceRecord(
  id: string,
  record: 'present' | 'absent'
): Promise<AttendanceSubject> {
  if (mode === 'local') return localAddRecord(id, record);
  try {
    const { subject } = await attendanceApi.addRecord(id, record);
    upsertCachedSubject(subject);
    return subject;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localAddRecord(id, record);
  }
}

export async function undoAttendanceRecord(id: string): Promise<AttendanceSubject> {
  if (mode === 'local') return localUndoRecord(id);
  try {
    const { subject } = await attendanceApi.undoRecord(id);
    upsertCachedSubject(subject);
    return subject;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUndoRecord(id);
  }
}

export async function updateAttendanceTarget(id: string, target: number): Promise<AttendanceSubject> {
  if (mode === 'local') return localUpdateTarget(id, target);
  try {
    const { subject } = await attendanceApi.updateTarget(id, target);
    upsertCachedSubject(subject);
    return subject;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdateTarget(id, target);
  }
}

export async function deleteAttendanceSubject(id: string): Promise<{ success: true }> {
  if (mode === 'local') return localDelete(id);
  try {
    const response = await attendanceApi.delete(id);
    removeCachedSubject(id);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localDelete(id);
  }
}
