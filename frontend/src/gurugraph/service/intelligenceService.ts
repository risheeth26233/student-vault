// GuruGraph — intelligence service boundary.
//
// Single entry point through which later GuruGraph logic (knowledge graph,
// mastery, gaps, and eventually agents) can:
//   1. ingest learning signals from Student-Vault data,
//   2. calculate/update intelligence deterministically,
//   3. retrieve topic/concept/subject intelligence with explainability data.
//
// The service is read-only with respect to Student-Vault: it never writes back
// to topics, assignments, attendance, assessments or resources.

import type {
  ConceptIntelligence,
  ConceptRelationship,
  ExplanationRecord,
  GuruGraphDataSource,
  GuruGraphIntelligenceService,
  GuruGraphServiceOptions,
  GuruGraphStorage,
  IngestReport,
  IntelligenceSnapshot,
  NormalizedSignals,
  RelationshipInput,
  SubjectIntelligence,
  TopicIntelligence,
} from '../domain/types';
import { INTELLIGENCE_VERSION, STORAGE_KEYS } from '../domain/constants';
import { relationshipId } from '../domain/ids';
import { buildIngestReport, normalizeLearningSignals } from '../signals/normalize';
import { computeMasteryRecords } from '../intelligence/mastery';
import { detectLearningGaps } from '../intelligence/gaps';
import { defaultStorage } from './storage';

interface PersistedEnvelope {
  version: number;
  normalized: NormalizedSignals | null;
  report: IngestReport | null;
  snapshot: IntelligenceSnapshot | null;
}

interface PersistedRelationships {
  version: number;
  relationships: ConceptRelationship[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStored(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function restoreEnvelope(value: unknown): PersistedEnvelope | null {
  if (!isObject(value)) return null;
  if (value.version !== INTELLIGENCE_VERSION) return null;
  const snapshot = isObject(value.snapshot) ? (value.snapshot as unknown as IntelligenceSnapshot) : null;
  if (snapshot && !Array.isArray(snapshot.mastery)) return null;
  const normalized = isObject(value.normalized)
    ? (value.normalized as unknown as NormalizedSignals)
    : null;
  if (normalized && !Array.isArray(normalized.signals)) return null;
  return {
    version: INTELLIGENCE_VERSION,
    normalized,
    report: isObject(value.report) ? (value.report as unknown as IngestReport) : null,
    snapshot,
  };
}

function restoreRelationships(value: unknown): ConceptRelationship[] {
  if (!isObject(value) || value.version !== INTELLIGENCE_VERSION) return [];
  if (!Array.isArray(value.relationships)) return [];
  return value.relationships.filter((item): item is ConceptRelationship => isObject(item));
}

function countKind(normalized: NormalizedSignals, kind: string): number {
  return normalized.signals.filter((signal) => signal.kind === kind).length;
}

export function createGuruGraphService(
  options: GuruGraphServiceOptions = {}
): GuruGraphIntelligenceService {
  const now = options.now ?? (() => new Date().toISOString());
  const storage: GuruGraphStorage | null =
    options.storage === undefined ? defaultStorage() : options.storage;

  let normalized: NormalizedSignals | null = null;
  let report: IngestReport | null = null;
  let snapshot: IntelligenceSnapshot | null = null;
  let relationships: ConceptRelationship[] = [];

  if (storage) {
    const envelope = restoreEnvelope(parseStored(storage.get(STORAGE_KEYS.snapshot)));
    if (envelope) {
      normalized = envelope.normalized;
      report = envelope.report;
      snapshot = envelope.snapshot;
    }
    relationships = restoreRelationships(parseStored(storage.get(STORAGE_KEYS.relationships)));
    if (snapshot) snapshot.relationships = [...relationships];
  }

  function persist(): void {
    if (!storage) return;
    const envelope: PersistedEnvelope = { version: INTELLIGENCE_VERSION, normalized, report, snapshot };
    storage.set(STORAGE_KEYS.snapshot, JSON.stringify(envelope));
  }

  function persistRelationships(): void {
    if (!storage) return;
    const payload: PersistedRelationships = { version: INTELLIGENCE_VERSION, relationships };
    storage.set(STORAGE_KEYS.relationships, JSON.stringify(payload));
    if (snapshot) snapshot.relationships = [...relationships];
  }

  function requireNormalized(): NormalizedSignals {
    if (!normalized) {
      throw new Error('GuruGraph: ingest() must run before intelligence can be computed.');
    }
    return normalized;
  }

  function ingest(source: GuruGraphDataSource): IngestReport {
    const collectedAt = now();
    normalized = normalizeLearningSignals(source, collectedAt);
    report = buildIngestReport(normalized, {
      topics: normalized.topics.length,
      assessments: countKind(normalized, 'assessment_result'),
      assignments: countKind(normalized, 'assignment_outcome'),
      attendance: normalized.attendance.length,
      resources: countKind(normalized, 'resource_activity'),
    });
    persist();
    return report;
  }

  function compute(): IntelligenceSnapshot {
    const current = requireNormalized();
    const computedAt = now();
    const mastery = computeMasteryRecords(current, computedAt);
    const gaps = detectLearningGaps(current, computedAt);

    snapshot = {
      version: INTELLIGENCE_VERSION,
      computedAt,
      report: report ?? buildIngestReport(current, {
        topics: current.topics.length,
        assessments: countKind(current, 'assessment_result'),
        assignments: countKind(current, 'assignment_outcome'),
        attendance: current.attendance.length,
        resources: countKind(current, 'resource_activity'),
      }),
      subjects: current.subjects,
      topics: current.topics,
      concepts: current.concepts,
      relationships: [...relationships],
      signals: current.signals,
      attendance: current.attendance,
      mastery,
      gaps,
    };
    persist();
    return snapshot;
  }

  function getTopicIntelligence(topicId: string): TopicIntelligence | null {
    const current = snapshot;
    if (!current) return null;
    const topic = current.topics.find((item) => item.id === topicId);
    if (!topic) return null;
    return {
      topic,
      concepts: current.concepts.filter((concept) => concept.topicIds.includes(topicId)),
      signals: current.signals.filter((signal) => signal.topicId === topicId),
      mastery: current.mastery.filter((record) => record.topicId === topicId),
      gaps: current.gaps.filter((gap) => gap.topicId === topicId),
    };
  }

  function getConceptIntelligence(conceptId: string): ConceptIntelligence | null {
    const current = snapshot;
    if (!current) return null;
    const concept = current.concepts.find((item) => item.id === conceptId);
    if (!concept) return null;
    return {
      concept,
      relationships: current.relationships.filter(
        (edge) => edge.fromConceptId === conceptId || edge.toConceptId === conceptId
      ),
      signals: current.signals.filter((signal) => signal.conceptIds.includes(conceptId)),
      mastery: current.mastery.filter((record) => record.conceptId === conceptId),
      gaps: [],
    };
  }

  function getSubjectIntelligence(subjectId: string): SubjectIntelligence | null {
    const current = snapshot;
    if (!current) return null;
    const subject = current.subjects.find((item) => item.id === subjectId);
    if (!subject) return null;
    return {
      subject,
      topics: current.topics.filter((topic) => topic.subjectId === subjectId),
      concepts: current.concepts.filter((concept) => concept.subjectId === subjectId),
      signals: current.signals.filter((signal) => signal.subjectId === subjectId),
      mastery: current.mastery.filter((record) => record.subjectId === subjectId),
      gaps: current.gaps.filter((gap) => gap.subjectId === subjectId),
      attendance: current.attendance.find((item) => item.subjectId === subjectId) ?? null,
    };
  }

  function addRelationship(input: RelationshipInput): ConceptRelationship {
    const from = input.fromConceptId?.trim();
    const to = input.toConceptId?.trim();
    if (!from || !to) throw new Error('GuruGraph: both concept ids are required.');
    if (from === to) throw new Error('GuruGraph: a concept cannot relate to itself.');
    if (input.kind !== 'prerequisite' && input.kind !== 'related' && input.kind !== 'part_of') {
      throw new Error(`GuruGraph: unsupported relationship kind "${String(input.kind)}".`);
    }

    const id = relationshipId(from, to, input.kind);
    if (relationships.some((edge) => edge.id === id)) {
      throw new Error('GuruGraph: that relationship already exists.');
    }

    const relationship: ConceptRelationship = {
      id,
      fromConceptId: from,
      toConceptId: to,
      kind: input.kind,
      origin: input.origin ?? 'manual',
      note: input.note?.trim() ?? '',
      createdAt: now(),
    };
    relationships = [...relationships, relationship].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    persistRelationships();
    return relationship;
  }

  function removeRelationship(id: string): boolean {
    const next = relationships.filter((edge) => edge.id !== id);
    if (next.length === relationships.length) return false;
    relationships = next;
    persistRelationships();
    return true;
  }

  function explain(recordId: string): ExplanationRecord | null {
    const current = snapshot;
    if (!current) return null;

    const signal = current.signals.find((item) => item.id === recordId);
    if (signal) {
      return {
        id: signal.id,
        kind: 'signal',
        summary: `${signal.kind.replace(/_/g, ' ')} — ${signal.evidence.label}`,
        reasons: [
          signal.evidence.detail,
          `Weight ${signal.weight} for this signal kind`,
          `Observed at ${signal.observedAt}`,
          signal.outcome.type === 'none'
            ? `Outcome recorded as "${signal.outcome.raw}" with no measurable score`
            : `Normalized outcome ${signal.outcome.value} from "${signal.outcome.raw}"`,
        ],
        evidence: [signal.evidence],
      };
    }

    const mastery = current.mastery.find((item) => item.key === recordId);
    if (mastery) {
      const evidenceById = new Map(current.signals.map((item) => [item.id, item]));
      const reasons = [
        `Level "${mastery.level}" with confidence "${mastery.confidence}" from ${mastery.evidenceCount} evidence signal(s).`,
        `Computed by rule ${mastery.ruleId}.`,
        ...mastery.contributions.map(
          (item) => `${item.reason} (weight ${item.weight}, contribution ${item.weightedValue})`
        ),
        mastery.disclaimer,
      ];
      const evidence = mastery.contributions
        .map((item) => evidenceById.get(item.signalId)?.evidence)
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      return { id: mastery.key, kind: 'mastery', summary: `Mastery of ${mastery.label}`, reasons, evidence };
    }

    const gap = current.gaps.find((item) => item.id === recordId);
    if (gap) {
      return {
        id: gap.id,
        kind: 'gap',
        summary: `${gap.category.replace(/_/g, ' ')} — ${gap.label}`,
        reasons: [gap.reason, gap.detail, `Rule ${gap.ruleId}`, gap.disclaimer],
        evidence: gap.evidence,
      };
    }

    return null;
  }

  function clear(): void {
    normalized = null;
    report = null;
    snapshot = null;
    relationships = [];
    if (storage) {
      storage.remove(STORAGE_KEYS.snapshot);
      storage.remove(STORAGE_KEYS.relationships);
    }
  }

  return {
    ingest,
    compute,
    getSnapshot: () => snapshot,
    getNormalized: () => normalized,
    getTopicIntelligence,
    getConceptIntelligence,
    getSubjectIntelligence,
    listRelationships: () => [...relationships],
    addRelationship,
    removeRelationship,
    explain,
    clear,
  };
}
