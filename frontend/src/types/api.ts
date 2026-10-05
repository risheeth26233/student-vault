// Student Vault TypeScript Types
// Generated from backend Zod schemas

export interface Topic {
  id: string;
  userId: string;
  subject: string;
  title: string;
  examDate: string | null;
  notes: string;
  status: 'learning' | 'reviewing' | 'ready';
  checklist: {
    understand: boolean;
    practice: boolean;
    revise: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TopicCreate {
  subject: string;
  title: string;
  examDate?: string | null;
  notes?: string;
  status?: 'learning' | 'reviewing' | 'ready';
  checklist?: {
    understand: boolean;
    practice: boolean;
    revise: boolean;
  };
}

export interface TopicUpdate {
  subject?: string;
  title?: string;
  examDate?: string | null;
  notes?: string;
  status?: 'learning' | 'reviewing' | 'ready';
  checklist?: {
    understand: boolean;
    practice: boolean;
    revise: boolean;
  };
}

export interface TopicsListResponse {
  topics: Topic[];
  total: number;
}

export interface AttendanceSubject {
  id: string;
  userId: string;
  name: string;
  target: number;
  createdAt: string;
  updatedAt: string;
  records: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  record: 'present' | 'absent';
  createdAt: string;
}

export interface AttendanceSubjectCreate {
  name: string;
  target?: number;
}

export interface AttendanceSubjectUpdate {
  name?: string;
  target?: number;
}

export interface AttendanceSubjectsListResponse {
  subjects: AttendanceSubject[];
  total: number;
}

export interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalClasses: number;
  overallPercentage: string;
  subjectsTracked: number;
}

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';

export type AssignmentPriority = 'low' | 'medium' | 'high';

export interface Assignment {
  id: string;
  userId: string;
  title: string;
  description: string;
  subject: string;
  topicId: string | null;
  dueDate: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentCreate {
  title: string;
  description?: string;
  subject: string;
  topicId?: string | null;
  dueDate?: string | null;
  status?: AssignmentStatus;
  priority?: AssignmentPriority;
}

export interface AssignmentUpdate {
  title?: string;
  description?: string;
  subject?: string;
  topicId?: string | null;
  dueDate?: string | null;
  status?: AssignmentStatus;
  priority?: AssignmentPriority;
}

export interface AssignmentsListResponse {
  assignments: Assignment[];
  total: number;
}

export type AssessmentType = 'quiz' | 'test' | 'exam' | 'assignment' | 'other';

export interface Assessment {
  id: string;
  userId: string;
  title: string;
  subject: string;
  topicId: string | null;
  type: AssessmentType;
  score: number;
  maxScore: number;
  percentage: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentCreate {
  title: string;
  subject: string;
  topicId?: string | null;
  type?: AssessmentType;
  score: number;
  maxScore: number;
  date: string;
}

export interface AssessmentUpdate {
  title?: string;
  subject?: string;
  topicId?: string | null;
  type?: AssessmentType;
  score?: number;
  maxScore?: number;
  date?: string;
}

export interface AssessmentsListResponse {
  assessments: Assessment[];
  total: number;
}

export interface Resource {
  id: string;
  userId: string;
  topicId: string;
  name: string;
  mimeType: string;
  size: string;
  data: string | null;
  r2Key: string | null;
  downloadUrl: string | null;
  createdAt: string;
}

export interface ResourceCreate {
  topicId: string;
  name: string;
  mimeType: string;
  size: number | string;
  data?: string | null;
  r2Key?: string | null;
}

export interface ResourcesListResponse {
  resources: Resource[];
  total: number;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  embedUrl: string;
}

export interface YouTubeSearchOptions {
  query: string;
  maxResults?: number;
  order?: 'relevance' | 'date' | 'rating' | 'viewCount' | 'title';
  type?: 'video' | 'channel' | 'playlist';
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
  videoDefinition?: 'any' | 'high' | 'standard';
  safeSearch?: 'none' | 'moderate' | 'strict';
}

export interface YouTubeSearchResponse {
  videos: YouTubeVideo[];
  nextPageToken?: string;
  totalResults: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  safeSearch?: 'off' | 'moderate' | 'strict';
  freshness?: 'day' | 'week' | 'month' | 'year';
  language?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
  provider?: string;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvidersResponse {
  providers: string[];
  default: string | null;
}

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  model?: string;
  format?: 'png' | 'jpeg' | 'webp';
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  prompt: string;
  seed: number;
  format?: string;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
  creditsUsed?: number;
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  serverVersion: number;
  hasLocalChanges?: boolean;
}

export interface SyncPullResponse {
  profile: { name: string | null } | null;
  topics: Topic[];
  attendanceSubjects: AttendanceSubject[];
  resources: Resource[];
  serverVersion: number;
}

export interface SyncPushRequest {
  profile?: { name: string } | null;
  topics: (Topic & { _deleted?: boolean })[];
  attendanceSubjects: (AttendanceSubject & { _deleted?: boolean })[];
  resources: (Resource & { _deleted?: boolean })[];
  clientVersion?: number;
}

export interface SyncConflict {
  type: 'topic' | 'attendanceSubject' | 'resource';
  id: string;
  serverData: unknown;
  clientData: unknown;
}

export interface SyncPushResponse {
  success: boolean;
  message: string;
  serverVersion: number;
  conflicts?: SyncConflict[];
  stats?: {
    topicsCreated: number;
    topicsUpdated: number;
    topicsDeleted: number;
    attendanceCreated: number;
    attendanceUpdated: number;
    attendanceDeleted: number;
    resourcesCreated: number;
    resourcesUpdated: number;
    resourcesDeleted: number;
  };
}

export interface R2UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string | null;
}

export interface R2DownloadUrlResponse {
  downloadUrl: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface BackupV1 {
  version: 1;
  exportedAt: string;
  profile: { name: string } | null;
  topics: Topic[];
  attendanceSubjects: AttendanceSubject[];
  resources: Resource[];
}

export interface ImportResponse {
  success: boolean;
  message: string;
  stats?: {
    topicsImported: number;
    attendanceSubjectsImported: number;
    resourcesImported: number;
  };
}