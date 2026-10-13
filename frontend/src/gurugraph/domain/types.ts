// GuruGraph — learning intelligence domain types.
//
// Boundary rule: Student-Vault owns user-facing academic data and workflows;
// GuruGraph only *consumes* normalized signals and produces explainable
// intelligence records. Nothing in this file replaces a Student-Vault model.

// ---------------------------------------------------------------------------
// Academic scope (mapped from existing Student-Vault data)
// ---------------------------------------------------------------------------

/** A Student-Vault subject, identified by a stable id derived from its name. */
export interface SubjectRef {
  id: string;
  /** Display label as the student typed it (first spelling seen wins). */
  label: string;
  /** Where the name was observed, e.g. 'topic' | 'assignment' | 'assessment' | 'attendance' | 'registry'. */
  sources: string[];
}

/** A Student-Vault topic projected into the intelligence layer. */
export interface TopicRef {
  id: string;
  subjectId: string;
  title: string;
  /** Student-Vault status: 'learning' | 'reviewing' | 'ready'. */
  status: string;
  examDate: string | null;
}

// ---------------------------------------------------------------------------
// Concept / knowledge representation foundation
// ---------------------------------------------------------------------------

export type ConceptOrigin = 'topic_derived' | 'manual';

/** Minimum concept node. Phase 2 derives one concept per Student-Vault topic. */
export interface ConceptNode {
  id: string;
  subjectId: string;
  label: string;
  topicIds: string[];
  origin: ConceptOrigin;
}

export type RelationshipKind = 'prerequisite' | 'related' | 'part_of';

export type RelationshipOrigin = 'manual' | 'curator';

/** A concept-to-concept edge. None are inferred automatically in Phase 2. */
export interface ConceptRelationship {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  kind: RelationshipKind;
  origin: RelationshipOrigin;
  note: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Normalized learning signals
// ---------------------------------------------------------------------------

export type LearningSignalKind =
  | 'assessment_result'
  | 'assignment_outcome'
  | 'attendance_session'
  | 'study_activity'
  | 'resource_activity';

export type SignalSourceType =
  | 'topic'
  | 'assessment'
  | 'assignment'
  | 'attendance'
  | 'resource'
  | 'subject_registry';

/** Pointer back to the exact Student-Vault record a signal came from. */
export interface EvidenceRef {
  sourceType: SignalSourceType;
  sourceId: string;
  label: string;
  detail: string;
  observedAt: string;
}

/**
 * Measured outcome of a signal, always normalized to 0..1.
 * `none` means the record was meaningful activity but carries no measurable
 * outcome (e.g. an assignment still in progress) — never faked into a score.
 */
export type SignalOutcome =
  | { type: 'scored'; value: number; raw: string }
  | { type: 'binary'; value: number; raw: string }
  | { type: 'progress'; value: number; raw: string }
  | { type: 'none'; raw: string };

export interface LearningSignal {
  id: string;
  kind: LearningSignalKind;
  subjectId: string;
  topicId: string | null;
  conceptIds: string[];
  observedAt: string;
  outcome: SignalOutcome;
  /** Relative contribution weight for mastery (from SIGNAL_WEIGHTS). */
  weight: number;
  evidence: EvidenceRef;
}

/** A record that could not be normalized — kept so gaps are explainable. */
export interface SkippedRecord {
  sourceType: SignalSourceType;
  sourceId: string;
  reason: SkippedReason;
}

export type SkippedReason =
  | 'missing_id'
  | 'missing_subject'
  | 'invalid_title'
  | 'invalid_score'
  | 'invalid_date'
  | 'invalid_status'
  | 'invalid_checklist'
  | 'unknown_topic';

/** Attendance rolled up per subject (context for gap classification). */
export interface AttendanceSummary {
  subjectId: string;
  label: string;
  target: number;
  present: number;
  absent: number;
  total: number;
  /** present/total, 4dp, or null when no sessions were recorded. */
  rate: number | null;
  sourceIds: string[];
}

// ---------------------------------------------------------------------------
// Normalized payload produced by signal ingestion
// ---------------------------------------------------------------------------

export interface NormalizedSignals {
  version: 1;
  collectedAt: string;
  subjects: SubjectRef[];
  topics: TopicRef[];
  concepts: ConceptNode[];
  relationships: ConceptRelationship[];
  signals: LearningSignal[];
  attendance: AttendanceSummary[];
  skipped: SkippedRecord[];
}

/** Raw Student-Vault data accepted by the intelligence layer. Read-only. */
export interface GuruGraphDataSource {
  topics?: readonly unknown[];
  assessments?: readonly unknown[];
  assignments?: readonly unknown[];
  attendanceSubjects?: readonly unknown[];
  resources?: readonly unknown[];
  /** Subject registry from `sv_subjects` (subjects with no topic yet). */
  subjectRegistry?: readonly string[];
}

export interface IngestReport {
  collectedAt: string;
  accepted: {
    topics: number;
    assessments: number;
    assignments: number;
    attendance: number;
    resources: number;
    subjects: number;
  };
  signals: number;
  skipped: SkippedRecord[];
}

// ---------------------------------------------------------------------------
// Mastery foundation
// ---------------------------------------------------------------------------

export type MasteryLevel = 'insufficient_evidence' | 'emerging' | 'developing' | 'secure';

export type EvidenceConfidence = 'none' | 'low' | 'medium' | 'high';

/** Per-signal contribution so a future UI can explain the number. */
export interface MasteryContribution {
  signalId: string;
  kind: LearningSignalKind;
  value: number;
  weight: number;
  weightedValue: number;
  reason: string;
}

export interface MasteryRecord {
  key: string;
  scope: 'subject' | 'topic' | 'concept';
  subjectId: string;
  topicId: string | null;
  conceptId: string | null;
  label: string;
  level: MasteryLevel;
  /** Weighted evidence average, or null when evidence is insufficient. */
  score: number | null;
  evidenceCount: number;
  confidence: EvidenceConfidence;
  contributingKinds: LearningSignalKind[];
  contributions: MasteryContribution[];
  computedAt: string;
  ruleId: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Learning gap foundation
// ---------------------------------------------------------------------------

/**
 * A gap finding must always say which of the five states it belongs to.
 * `confirmed_misconception` is reserved for a later engine and is never
 * produced by Phase 2.
 */
export type GapCategory =
  | 'potential_learning_gap'
  | 'low_attendance'
  | 'missing_data'
  | 'insufficient_evidence'
  | 'confirmed_misconception';

export type GapSeverity = 'unknown' | 'low' | 'medium' | 'high';

/** Machine-readable flags that keep the five states distinguishable. */
export interface GapDistinguishers {
  confirmedMisconception: boolean;
  lowAttendance: boolean;
  missingData: boolean;
  insufficientEvidence: boolean;
}

export interface LearningGap {
  id: string;
  category: GapCategory;
  scope: 'subject' | 'topic';
  subjectId: string;
  topicId: string | null;
  label: string;
  severity: GapSeverity;
  status: 'candidate';
  reason: string;
  detail: string;
  ruleId: string;
  evidence: EvidenceRef[];
  distinguishers: GapDistinguishers;
  detectedAt: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Aggregated intelligence views
// ---------------------------------------------------------------------------

export interface TopicIntelligence {
  topic: TopicRef;
  concepts: ConceptNode[];
  signals: LearningSignal[];
  mastery: MasteryRecord[];
  gaps: LearningGap[];
}

export interface ConceptIntelligence {
  concept: ConceptNode;
  relationships: ConceptRelationship[];
  signals: LearningSignal[];
  mastery: MasteryRecord[];
  gaps: LearningGap[];
}

export interface SubjectIntelligence {
  subject: SubjectRef;
  topics: TopicRef[];
  concepts: ConceptNode[];
  signals: LearningSignal[];
  mastery: MasteryRecord[];
  gaps: LearningGap[];
  attendance: AttendanceSummary | null;
}

export interface IntelligenceSnapshot {
  version: number;
  computedAt: string;
  report: IngestReport;
  subjects: SubjectRef[];
  topics: TopicRef[];
  concepts: ConceptNode[];
  relationships: ConceptRelationship[];
  signals: LearningSignal[];
  attendance: AttendanceSummary[];
  mastery: MasteryRecord[];
  gaps: LearningGap[];
}

/** Why a record exists — enough source data for a future explainability UI. */
export interface ExplanationRecord {
  id: string;
  kind: 'signal' | 'mastery' | 'gap';
  summary: string;
  reasons: string[];
  evidence: EvidenceRef[];
}

// ---------------------------------------------------------------------------
// Service boundary
// ---------------------------------------------------------------------------

export interface GuruGraphStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface GuruGraphServiceOptions {
  /** Clock injection keeps every computed timestamp reproducible in tests. */
  now?: () => string;
  /** Persistence adapter. Pass null to run fully in memory. */
  storage?: GuruGraphStorage | null;
}

export interface GuruGraphIntelligenceService {
  ingest(source: GuruGraphDataSource): IngestReport;
  compute(): IntelligenceSnapshot;
  getSnapshot(): IntelligenceSnapshot | null;
  getNormalized(): NormalizedSignals | null;
  getTopicIntelligence(topicId: string): TopicIntelligence | null;
  getConceptIntelligence(conceptId: string): ConceptIntelligence | null;
  getSubjectIntelligence(subjectId: string): SubjectIntelligence | null;
  listRelationships(): ConceptRelationship[];
  addRelationship(input: RelationshipInput): ConceptRelationship;
  removeRelationship(id: string): boolean;
  explain(recordId: string): ExplanationRecord | null;
  clear(): void;
}

export interface RelationshipInput {
  fromConceptId: string;
  toConceptId: string;
  kind: RelationshipKind;
  note?: string;
  origin?: RelationshipOrigin;
}
