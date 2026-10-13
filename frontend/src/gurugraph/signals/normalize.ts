// GuruGraph — signal normalization.
//
// Converts existing Student-Vault records (topics, assessments, assignments,
// attendance, resources) into a single normalized learning-signal shape.
// Pure, deterministic and read-only: it never mutates or writes Student-Vault
// data, and it never invents information the student did not record.

import type {
  AttendanceSummary,
  ConceptNode,
  EvidenceRef,
  GuruGraphDataSource,
  IngestReport,
  LearningSignal,
  NormalizedSignals,
  SkippedRecord,
  SkippedReason,
  SignalSourceType,
  SubjectRef,
  TopicRef,
} from '../domain/types';
import { ATTENDANCE_TARGET_DEFAULT, SIGNAL_WEIGHTS, roundScore } from '../domain/constants';
import { conceptIdFromTopic, signalId, subjectIdFromLabel } from '../domain/ids';

type LooseRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Small runtime readers (Student-Vault data arrives as unknown in local mode)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Subject index — subjects are names in Student-Vault, ids are derived
// ---------------------------------------------------------------------------

interface SubjectIndexEntry {
  id: string;
  label: string;
  sources: Set<string>;
}

export function createSubjectIndex() {
  const entries = new Map<string, SubjectIndexEntry>();

  function ensure(label: unknown, source: string): SubjectRef | null {
    if (typeof label !== 'string') return null;
    const trimmed = label.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) return null;
    const key = trimmed.toLowerCase();
    const existing = entries.get(key);
    if (existing) {
      existing.sources.add(source);
      return { id: existing.id, label: existing.label, sources: [...existing.sources].sort(compareStrings) };
    }
    const id = subjectIdFromLabel(trimmed);
    entries.set(key, { id, label: trimmed, sources: new Set([source]) });
    return { id, label: trimmed, sources: [source] };
  }

  function list(): SubjectRef[] {
    return [...entries.values()]
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        sources: [...entry.sources].sort(compareStrings),
      }))
      .sort((a, b) => compareStrings(a.label, b.label) || compareStrings(a.id, b.id));
  }

  return { ensure, list };
}

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------

function evidence(
  sourceType: SignalSourceType,
  sourceId: string,
  label: string,
  detail: string,
  observedAt: string
): EvidenceRef {
  return { sourceType, sourceId, label, detail, observedAt };
}

function makeSignal(input: {
  kind: LearningSignal['kind'];
  subjectId: string;
  topicId: string | null;
  observedAt: string;
  outcome: LearningSignal['outcome'];
  evidence: EvidenceRef;
}): LearningSignal {
  const weight = SIGNAL_WEIGHTS[input.kind];
  return {
    id: signalId(input.kind, input.evidence.sourceId),
    kind: input.kind,
    subjectId: input.subjectId,
    topicId: input.topicId,
    conceptIds: input.topicId ? [conceptIdFromTopic(input.topicId)] : [],
    observedAt: input.observedAt,
    outcome: input.outcome,
    weight,
    evidence: input.evidence,
  };
}

function skip(sourceType: SignalSourceType, sourceId: string, reason: SkippedReason, into: SkippedRecord[]): void {
  into.push({ sourceType, sourceId, reason });
}

// ---------------------------------------------------------------------------
// Normalization passes
// ---------------------------------------------------------------------------

interface PassResult {
  signals: LearningSignal[];
  topics: TopicRef[];
  concepts: ConceptNode[];
  attendance: AttendanceSummary[];
  skipped: SkippedRecord[];
}

function normalizeTopics(
  source: GuruGraphDataSource,
  subjects: ReturnType<typeof createSubjectIndex>,
  out: PassResult
): void {
  for (const raw of readArray(source.topics)) {
    if (!isRecord(raw)) continue;
    const id = readId(raw.id);
    if (!id) {
      skip('topic', 'unknown', 'missing_id', out.skipped);
      continue;
    }
    const title = readTitle(raw.title);
    if (!title) {
      skip('topic', id, 'invalid_title', out.skipped);
      continue;
    }
    const subject = subjects.ensure(raw.subject, 'topic');
    if (!subject) {
      skip('topic', id, 'missing_subject', out.skipped);
      continue;
    }
    const status = typeof raw.status === 'string' ? raw.status : '';
    if (status !== 'learning' && status !== 'reviewing' && status !== 'ready') {
      skip('topic', id, 'invalid_status', out.skipped);
      continue;
    }

    const observedAt = readDate(raw.updatedAt) ?? readDate(raw.createdAt);
    if (!observedAt) {
      skip('topic', id, 'invalid_date', out.skipped);
      continue;
    }

    const examDate = readDate(raw.examDate);
    const topic: TopicRef = {
      id,
      subjectId: subject.id,
      title,
      status,
      examDate,
    };
    out.topics.push(topic);
    out.concepts.push({
      id: conceptIdFromTopic(id),
      subjectId: subject.id,
      label: title,
      topicIds: [id],
      origin: 'topic_derived',
    });

    // Study activity: checklist completion is a real, recorded progress signal.
    const checklist = raw.checklist;
    if (checklist === undefined || checklist === null) continue;
    if (!isRecord(checklist)) {
      skip('topic', id, 'invalid_checklist', out.skipped);
      continue;
    }
    const steps = ['understand', 'practice', 'revise'] as const;
    const valid = steps.every((step) => typeof checklist[step] === 'boolean');
    if (!valid) {
      skip('topic', id, 'invalid_checklist', out.skipped);
      continue;
    }
    const done = steps.filter((step) => checklist[step] === true);
    const value = roundScore(done.length / steps.length);
    out.signals.push(
      makeSignal({
        kind: 'study_activity',
        subjectId: subject.id,
        topicId: id,
        observedAt,
        outcome: { type: 'progress', value, raw: `${done.length}/${steps.length}` },
        evidence: evidence(
          'topic',
          id,
          `Topic: ${title}`,
          `Checklist ${done.length}/${steps.length} complete (${done.join(', ') || 'none'}); status ${status}`,
          observedAt
        ),
      })
    );
  }
}

function normalizeAssessments(
  source: GuruGraphDataSource,
  subjects: ReturnType<typeof createSubjectIndex>,
  topicIndex: Map<string, TopicRef>,
  out: PassResult
): void {
  for (const raw of readArray(source.assessments)) {
    if (!isRecord(raw)) continue;
    const id = readId(raw.id);
    if (!id) {
      skip('assessment', 'unknown', 'missing_id', out.skipped);
      continue;
    }
    const title = readTitle(raw.title) ?? 'Assessment';
    const subject = subjects.ensure(raw.subject, 'assessment');
    if (!subject) {
      skip('assessment', id, 'missing_subject', out.skipped);
      continue;
    }

    const score = typeof raw.score === 'number' ? raw.score : NaN;
    const maxScore = typeof raw.maxScore === 'number' ? raw.maxScore : NaN;
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0) {
      skip('assessment', id, 'invalid_score', out.skipped);
      continue;
    }

    const observedAt = readDate(raw.date) ?? readDate(raw.createdAt);
    if (!observedAt) {
      skip('assessment', id, 'invalid_date', out.skipped);
      continue;
    }

    const linkedTopicId = readId(raw.topicId);
    const topicId = linkedTopicId && topicIndex.has(linkedTopicId) ? linkedTopicId : null;
    const type = typeof raw.type === 'string' ? raw.type : 'other';
    const value = roundScore(Math.min(score / maxScore, 1));

    out.signals.push(
      makeSignal({
        kind: 'assessment_result',
        subjectId: subject.id,
        topicId,
        observedAt,
        outcome: { type: 'scored', value, raw: `${score}/${maxScore}` },
        evidence: evidence(
          'assessment',
          id,
          `Assessment: ${title}`,
          `${type} score ${score}/${maxScore} (${Math.round(value * 100)}%)`,
          observedAt
        ),
      })
    );
  }
}

function normalizeAssignments(
  source: GuruGraphDataSource,
  subjects: ReturnType<typeof createSubjectIndex>,
  topicIndex: Map<string, TopicRef>,
  out: PassResult
): void {
  for (const raw of readArray(source.assignments)) {
    if (!isRecord(raw)) continue;
    const id = readId(raw.id);
    if (!id) {
      skip('assignment', 'unknown', 'missing_id', out.skipped);
      continue;
    }
    const title = readTitle(raw.title) ?? 'Assignment';
    const subject = subjects.ensure(raw.subject, 'assignment');
    if (!subject) {
      skip('assignment', id, 'missing_subject', out.skipped);
      continue;
    }

    const status = typeof raw.status === 'string' ? raw.status : '';
    if (status !== 'pending' && status !== 'in_progress' && status !== 'completed') {
      skip('assignment', id, 'invalid_status', out.skipped);
      continue;
    }

    const observedAt = readDate(raw.updatedAt) ?? readDate(raw.createdAt);
    if (!observedAt) {
      skip('assignment', id, 'invalid_date', out.skipped);
      continue;
    }

    const linkedTopicId = readId(raw.topicId);
    const topicId = linkedTopicId && topicIndex.has(linkedTopicId) ? linkedTopicId : null;
    const outcome: LearningSignal['outcome'] =
      status === 'completed'
        ? { type: 'binary', value: 1, raw: 'completed' }
        : { type: 'none', raw: status };

    out.signals.push(
      makeSignal({
        kind: 'assignment_outcome',
        subjectId: subject.id,
        topicId,
        observedAt,
        outcome,
        evidence: evidence(
          'assignment',
          id,
          `Assignment: ${title}`,
          `status ${status}`,
          observedAt
        ),
      })
    );
  }
}

function normalizeAttendance(
  source: GuruGraphDataSource,
  subjects: ReturnType<typeof createSubjectIndex>,
  out: PassResult
): void {
  for (const raw of readArray(source.attendanceSubjects)) {
    if (!isRecord(raw)) continue;
    const id = readId(raw.id);
    if (!id) {
      skip('attendance', 'unknown', 'missing_id', out.skipped);
      continue;
    }
    const name = typeof raw.name === 'string' ? raw.name : '';
    const subject = subjects.ensure(name, 'attendance');
    if (!subject) {
      skip('attendance', id, 'missing_subject', out.skipped);
      continue;
    }

    const target =
      typeof raw.target === 'number' && Number.isFinite(raw.target) && raw.target > 0 && raw.target <= 100
        ? raw.target
        : ATTENDANCE_TARGET_DEFAULT;

    let present = 0;
    let absent = 0;
    const sourceIds: string[] = [];

    for (const rawRecord of readArray(raw.records)) {
      if (!isRecord(rawRecord)) continue;
      const recordId = readId(rawRecord.id);
      const kind = rawRecord.record;
      if (!recordId || (kind !== 'present' && kind !== 'absent')) {
        skip('attendance', recordId ?? `${id}/record`, 'invalid_status', out.skipped);
        continue;
      }
      const observedAt = readDate(rawRecord.createdAt);
      if (!observedAt) {
        skip('attendance', recordId, 'invalid_date', out.skipped);
        continue;
      }

      if (kind === 'present') present += 1;
      else absent += 1;
      sourceIds.push(recordId);

      out.signals.push(
        makeSignal({
          kind: 'attendance_session',
          subjectId: subject.id,
          topicId: null,
          observedAt,
          outcome: { type: 'binary', value: kind === 'present' ? 1 : 0, raw: kind },
          evidence: evidence(
            'attendance',
            recordId,
            `Attendance: ${subject.label}`,
            `recorded ${kind}`,
            observedAt
          ),
        })
      );
    }

    const total = present + absent;
    out.attendance.push({
      subjectId: subject.id,
      label: subject.label,
      target,
      present,
      absent,
      total,
      rate: total > 0 ? roundScore(present / total) : null,
      sourceIds: sourceIds.sort(compareStrings),
    });
  }
}

function normalizeResources(
  source: GuruGraphDataSource,
  topicIndex: Map<string, TopicRef>,
  out: PassResult
): void {
  for (const raw of readArray(source.resources)) {
    if (!isRecord(raw)) continue;
    const id = readId(raw.id);
    if (!id) {
      skip('resource', 'unknown', 'missing_id', out.skipped);
      continue;
    }
    const topicId = readId(raw.topicId);
    const topic = topicId ? topicIndex.get(topicId) : undefined;
    if (!topic) {
      skip('resource', id, 'unknown_topic', out.skipped);
      continue;
    }
    const observedAt = readDate(raw.createdAt);
    if (!observedAt) {
      skip('resource', id, 'invalid_date', out.skipped);
      continue;
    }
    const name = readTitle(raw.name) ?? 'document';
    out.signals.push(
      makeSignal({
        kind: 'resource_activity',
        subjectId: topic.subjectId,
        topicId: topic.id,
        observedAt,
        outcome: { type: 'binary', value: 1, raw: 'attached' },
        evidence: evidence(
          'resource',
          id,
          `Resource: ${name}`,
          `attached to ${topic.title}`,
          observedAt
        ),
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Normalize every supported Student-Vault source into learning signals. */
export function normalizeLearningSignals(
  source: GuruGraphDataSource,
  collectedAt: string
): NormalizedSignals {
  const subjects = createSubjectIndex();
  const out: PassResult = { signals: [], topics: [], concepts: [], attendance: [], skipped: [] };

  for (const name of source.subjectRegistry ?? []) {
    if (typeof name === 'string') subjects.ensure(name, 'registry');
  }

  normalizeTopics(source, subjects, out);

  const topicIndex = new Map<string, TopicRef>();
  for (const topic of out.topics) {
    if (!topicIndex.has(topic.id)) topicIndex.set(topic.id, topic);
  }

  normalizeAssessments(source, subjects, topicIndex, out);
  normalizeAssignments(source, subjects, topicIndex, out);
  normalizeAttendance(source, subjects, out);
  normalizeResources(source, topicIndex, out);

  return {
    version: 1,
    collectedAt,
    subjects: subjects.list(),
    topics: [...out.topics].sort((a, b) => compareStrings(a.id, b.id)),
    concepts: [...out.concepts].sort((a, b) => compareStrings(a.id, b.id)),
    relationships: [],
    signals: [...out.signals].sort(
      (a, b) => compareStrings(a.observedAt, b.observedAt) || compareStrings(a.id, b.id)
    ),
    attendance: [...out.attendance].sort((a, b) => compareStrings(a.subjectId, b.subjectId)),
    skipped: [...out.skipped].sort(
      (a, b) => compareStrings(a.sourceType, b.sourceType) || compareStrings(a.sourceId, b.sourceId)
    ),
  };
}

/** Build the ingestion report that accompanies a normalization run. */
export function buildIngestReport(
  normalized: NormalizedSignals,
  counts: {
    topics: number;
    assessments: number;
    assignments: number;
    attendance: number;
    resources: number;
  }
): IngestReport {
  return {
    collectedAt: normalized.collectedAt,
    accepted: {
      ...counts,
      subjects: normalized.subjects.length,
    },
    signals: normalized.signals.length,
    skipped: normalized.skipped,
  };
}
