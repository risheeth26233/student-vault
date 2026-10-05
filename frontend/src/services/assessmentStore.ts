// Academic Performance (Assessments) Data Layer
// Single entry point for assessment reads/writes.
// Talks to the backend API and transparently falls back to localStorage when the
// API is unavailable (offline, backend not running, auth not configured) — the
// same pattern used by the topics, attendance, resources and assignments stores.

import { assessmentsApi } from './api';
import { loadAssessments, saveAssessments, createId } from './storage';
import type {
  Assessment,
  AssessmentCreate,
  AssessmentType,
  AssessmentUpdate,
  AssessmentsListResponse,
} from '../types/api';

export type AssessmentsStoreMode = 'api' | 'local';

const ASSESSMENT_TYPES: AssessmentType[] = ['quiz', 'test', 'exam', 'assignment', 'other'];

let mode: AssessmentsStoreMode = 'api';

export function getAssessmentsMode(): AssessmentsStoreMode {
  return mode;
}

export function isLocalAssessmentsMode(): boolean {
  return mode === 'local';
}

/** Reset to API mode and let the next request probe the backend again. */
export function resetAssessmentsMode(): void {
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

function normalizeType(value: unknown): AssessmentType {
  return ASSESSMENT_TYPES.includes(value as AssessmentType) ? (value as AssessmentType) : 'exam';
}

function normalizeCount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function normalizeDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function percentageOf(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score * 1000) / maxScore) / 10 : 0;
}

function normalizeAssessment(raw: unknown): Assessment | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  if (!title) return null;
  const subject = typeof source.subject === 'string' ? source.subject.trim() : '';
  if (!subject) return null;

  const maxScore = Math.max(normalizeCount(source.maxScore, 0), 1);
  const score = Math.max(normalizeCount(source.score, 0), 0);
  const now = new Date().toISOString();

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId(),
    userId: typeof source.userId === 'string' && source.userId ? source.userId : 'local',
    title,
    subject,
    topicId: typeof source.topicId === 'string' && source.topicId ? source.topicId : null,
    type: normalizeType(source.type),
    score,
    maxScore,
    percentage: typeof source.percentage === 'number' ? source.percentage : percentageOf(score, maxScore),
    date: normalizeDate(source.date),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
  };
}

function loadLocalAssessments(): Assessment[] {
  const raw = loadAssessments() as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeAssessment)
    .filter((assessment): assessment is Assessment => assessment !== null);
}

function saveLocalAssessments(assessments: Assessment[]): void {
  saveAssessments(assessments);
}

function assessmentNotFound(): never {
  const error = new Error('Assessment not found') as Error & { status: number };
  error.status = 404;
  throw error;
}

function invalidFieldError(message: string): never {
  const error = new Error(message) as Error & { status: number };
  error.status = 400;
  throw error;
}

function validateInput(data: AssessmentCreate | AssessmentUpdate): void {
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) invalidFieldError('Enter a title for the record.');
    if (title.length > 120) invalidFieldError('Title is limited to 120 characters.');
  }
  if (data.subject !== undefined && !data.subject.trim()) {
    invalidFieldError('Enter a subject for the record.');
  }
  if (data.score !== undefined) {
    if (!Number.isInteger(data.score)) invalidFieldError('Score must be a whole number.');
    if (data.score < 0) invalidFieldError('Score cannot be negative.');
    if (data.score > 100000) invalidFieldError('Score is out of range.');
  }
  if (data.maxScore !== undefined) {
    if (!Number.isInteger(data.maxScore)) invalidFieldError('Maximum score must be a whole number.');
    if (data.maxScore < 1) invalidFieldError('Maximum score must be at least 1.');
    if (data.maxScore > 100000) invalidFieldError('Maximum score is out of range.');
  }
  if (data.score !== undefined && data.maxScore !== undefined && data.score > data.maxScore) {
    invalidFieldError('Score cannot be higher than the maximum score.');
  }
  if (data.date !== undefined) {
    const parsed = new Date(data.date);
    if (Number.isNaN(parsed.getTime())) invalidFieldError('Enter a valid date.');
  }
}

// ---------------------------------------------------------------------------
// Local (localStorage-backed) implementations
// ---------------------------------------------------------------------------

function sortAssessments(assessments: Assessment[]): Assessment[] {
  return [...assessments].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function localList(): AssessmentsListResponse {
  const assessments = sortAssessments(loadLocalAssessments());
  return { assessments, total: assessments.length };
}

function localGet(id: string): Assessment {
  const assessment = loadLocalAssessments().find((item) => item.id === id);
  if (!assessment) assessmentNotFound();
  return assessment;
}

function localCreate(data: AssessmentCreate): Assessment {
  validateInput(data);

  const score = data.score;
  const maxScore = data.maxScore;
  if (score > maxScore) invalidFieldError('Score cannot be higher than the maximum score.');

  const now = new Date().toISOString();
  const assessment: Assessment = {
    id: createId(),
    userId: 'local',
    title: data.title.trim(),
    subject: data.subject.trim(),
    topicId: data.topicId ?? null,
    type: data.type ?? 'exam',
    score,
    maxScore,
    percentage: percentageOf(score, maxScore),
    date: normalizeDate(data.date),
    createdAt: now,
    updatedAt: now,
  };
  saveLocalAssessments([assessment, ...loadLocalAssessments()]);
  return assessment;
}

function localUpdate(id: string, data: AssessmentUpdate): Assessment {
  validateInput(data);

  const assessments = loadLocalAssessments();
  const index = assessments.findIndex((item) => item.id === id);
  if (index === -1) assessmentNotFound();

  const current = assessments[index];
  const nextScore = data.score !== undefined ? data.score : current.score;
  const nextMax = data.maxScore !== undefined ? data.maxScore : current.maxScore;
  if (nextScore > nextMax) invalidFieldError('Score cannot be higher than the maximum score.');

  const updated: Assessment = {
    ...current,
    ...(data.title !== undefined ? { title: data.title.trim() } : {}),
    ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
    ...(data.topicId !== undefined ? { topicId: data.topicId } : {}),
    ...(data.type !== undefined ? { type: normalizeType(data.type) } : {}),
    ...(data.score !== undefined ? { score: nextScore } : {}),
    ...(data.maxScore !== undefined ? { maxScore: nextMax } : {}),
    ...(data.date !== undefined ? { date: normalizeDate(data.date) } : {}),
    percentage: percentageOf(nextScore, nextMax),
    updatedAt: new Date().toISOString(),
  };
  assessments[index] = updated;
  saveLocalAssessments(assessments);
  return updated;
}

function localDelete(id: string): { success: true } {
  saveLocalAssessments(loadLocalAssessments().filter((item) => item.id !== id));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Local cache maintenance while running in API mode
// ---------------------------------------------------------------------------

function upsertCachedAssessment(assessment: Assessment): void {
  const assessments = loadLocalAssessments();
  const index = assessments.findIndex((item) => item.id === assessment.id);
  if (index === -1) {
    saveLocalAssessments([assessment, ...assessments]);
  } else {
    assessments[index] = assessment;
    saveLocalAssessments(assessments);
  }
}

function removeCachedAssessment(id: string): void {
  saveLocalAssessments(loadLocalAssessments().filter((item) => item.id !== id));
}

// ---------------------------------------------------------------------------
// Public API (API first, local fallback)
// ---------------------------------------------------------------------------

export async function listAssessments(
  params: Parameters<typeof assessmentsApi.list>[0] = {}
): Promise<AssessmentsListResponse> {
  if (mode === 'local') return localList();
  try {
    const response = await assessmentsApi.list(params);
    // Cache the authoritative copy so the offline fallback stays fresh.
    saveAssessments(response.assessments);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localList();
  }
}

export async function getAssessment(id: string): Promise<Assessment> {
  if (mode === 'local') return localGet(id);
  try {
    return await assessmentsApi.get(id);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localGet(id);
  }
}

export async function createAssessment(data: AssessmentCreate): Promise<Assessment> {
  if (mode === 'local') return localCreate(data);
  try {
    const assessment = await assessmentsApi.create(data);
    upsertCachedAssessment(assessment);
    return assessment;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localCreate(data);
  }
}

export async function updateAssessment(id: string, data: AssessmentUpdate): Promise<Assessment> {
  if (mode === 'local') return localUpdate(id, data);
  try {
    const assessment = await assessmentsApi.update(id, data);
    upsertCachedAssessment(assessment);
    return assessment;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localUpdate(id, data);
  }
}

export async function deleteAssessment(id: string): Promise<{ success: true }> {
  if (mode === 'local') return localDelete(id);
  try {
    const response = await assessmentsApi.delete(id);
    removeCachedAssessment(id);
    return response;
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    switchToLocalMode();
    return localDelete(id);
  }
}
