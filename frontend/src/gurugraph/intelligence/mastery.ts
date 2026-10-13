// GuruGraph — mastery foundation.
//
// Deliberately simple, deterministic and explainable: a weighted average of
// recorded evidence with an explicit "insufficient evidence" state. This is a
// starting point for later evidence types (repeated attempts, practice
// outcomes) — it is NOT an accurate prediction of what a student knows.

import type {
  ConceptNode,
  EvidenceConfidence,
  LearningSignal,
  MasteryContribution,
  MasteryLevel,
  MasteryRecord,
  NormalizedSignals,
  SubjectRef,
  TopicRef,
} from '../domain/types';
import {
  MASTERY_BANDS,
  MASTERY_DISCLAIMER,
  MASTERY_EXCLUDED_KINDS,
  MASTERY_RULE,
  MIN_MASTERY_EVIDENCE,
  roundScore,
} from '../domain/constants';
import { masteryRecordKey } from '../domain/ids';

const EXCLUDED = new Set<string>(MASTERY_EXCLUDED_KINDS);

/** A signal only counts as mastery evidence when it carries a real outcome. */
export function isMasteryEvidence(signal: LearningSignal): boolean {
  if (EXCLUDED.has(signal.kind)) return false;
  return signal.outcome.type !== 'none';
}

function contributionReason(signal: LearningSignal): string {
  switch (signal.kind) {
    case 'assessment_result':
      return `Assessment outcome ${signal.outcome.raw} (${Math.round(
        (signal.outcome.type === 'none' ? 0 : signal.outcome.value) * 100
      )}%)`;
    case 'assignment_outcome':
      return 'Assignment marked completed';
    case 'study_activity':
      return `Study checklist progress ${signal.outcome.raw}`;
    default:
      return `Recorded ${signal.kind.replace(/_/g, ' ')}`;
  }
}

function levelFor(score: number): MasteryLevel {
  if (score < MASTERY_BANDS.emergingMax) return 'emerging';
  if (score < MASTERY_BANDS.developingMax) return 'developing';
  return 'secure';
}

function confidenceFor(evidenceCount: number, distinctKinds: number): EvidenceConfidence {
  if (evidenceCount === 0) return 'none';
  if (evidenceCount >= 4 && distinctKinds >= 2) return 'high';
  if (evidenceCount >= 2) return 'medium';
  return 'low';
}

export interface ComputeMasteryInput {
  scope: 'subject' | 'topic' | 'concept';
  subjectId: string;
  topicId?: string | null;
  conceptId?: string | null;
  label: string;
  signals: readonly LearningSignal[];
  computedAt: string;
}

/** Compute one mastery record from the signals that belong to its scope. */
export function computeMastery(input: ComputeMasteryInput): MasteryRecord {
  const evidence = input.signals.filter(isMasteryEvidence);

  const contributions: MasteryContribution[] = evidence.map((signal) => {
    const value = signal.outcome.type === 'none' ? 0 : signal.outcome.value;
    const weightedValue = roundScore(value * signal.weight);
    return {
      signalId: signal.id,
      kind: signal.kind,
      value,
      weight: signal.weight,
      weightedValue,
      reason: contributionReason(signal),
    };
  });

  const weightSum = contributions.reduce((sum, item) => sum + item.weight, 0);
  const weightedSum = contributions.reduce((sum, item) => sum + item.weightedValue, 0);
  const hasEvidence = contributions.length >= MIN_MASTERY_EVIDENCE;

  const kinds = [...new Set(contributions.map((item) => item.kind))].sort();
  const score = hasEvidence ? roundScore(weightedSum / weightSum) : null;

  return {
    key: masteryRecordKey(input.subjectId, {
      topicId: input.topicId ?? null,
      conceptId: input.conceptId ?? null,
    }),
    scope: input.scope,
    subjectId: input.subjectId,
    topicId: input.topicId ?? null,
    conceptId: input.conceptId ?? null,
    label: input.label,
    level: hasEvidence ? levelFor(score ?? 0) : 'insufficient_evidence',
    score,
    evidenceCount: contributions.length,
    confidence: confidenceFor(contributions.length, kinds.length),
    contributingKinds: kinds,
    contributions,
    computedAt: input.computedAt,
    ruleId: MASTERY_RULE,
    disclaimer: MASTERY_DISCLAIMER,
  };
}

function signalsForTopic(normalized: NormalizedSignals, topicId: string): LearningSignal[] {
  return normalized.signals.filter((signal) => signal.topicId === topicId);
}

function signalsForConcept(normalized: NormalizedSignals, conceptId: string): LearningSignal[] {
  return normalized.signals.filter((signal) => signal.conceptIds.includes(conceptId));
}

function signalsForSubject(normalized: NormalizedSignals, subjectId: string): LearningSignal[] {
  return normalized.signals.filter((signal) => signal.subjectId === subjectId);
}

function byKey(a: MasteryRecord, b: MasteryRecord): number {
  if (a.key < b.key) return -1;
  if (a.key > b.key) return 1;
  return 0;
}

/** Mastery records for every topic, concept and subject in the snapshot. */
export function computeMasteryRecords(
  normalized: NormalizedSignals,
  computedAt: string
): MasteryRecord[] {
  const records: MasteryRecord[] = [];

  for (const topic of normalized.topics) {
    records.push(
      computeMastery({
        scope: 'topic',
        subjectId: topic.subjectId,
        topicId: topic.id,
        label: topic.title,
        signals: signalsForTopic(normalized, topic.id),
        computedAt,
      })
    );
  }

  for (const concept of normalized.concepts) {
    records.push(
      computeMastery({
        scope: 'concept',
        subjectId: concept.subjectId,
        conceptId: concept.id,
        label: concept.label,
        signals: signalsForConcept(normalized, concept.id),
        computedAt,
      })
    );
  }

  for (const subject of normalized.subjects) {
    records.push(
      computeMastery({
        scope: 'subject',
        subjectId: subject.id,
        label: subject.label,
        signals: signalsForSubject(normalized, subject.id),
        computedAt,
      })
    );
  }

  return records.sort(byKey);
}

export function topicMastery(
  normalized: NormalizedSignals,
  topic: TopicRef,
  computedAt: string
): MasteryRecord {
  return computeMastery({
    scope: 'topic',
    subjectId: topic.subjectId,
    topicId: topic.id,
    label: topic.title,
    signals: signalsForTopic(normalized, topic.id),
    computedAt,
  });
}

export function conceptMastery(
  normalized: NormalizedSignals,
  concept: ConceptNode,
  computedAt: string
): MasteryRecord {
  return computeMastery({
    scope: 'concept',
    subjectId: concept.subjectId,
    conceptId: concept.id,
    label: concept.label,
    signals: signalsForConcept(normalized, concept.id),
    computedAt,
  });
}

export function subjectMastery(
  normalized: NormalizedSignals,
  subject: SubjectRef,
  computedAt: string
): MasteryRecord {
  return computeMastery({
    scope: 'subject',
    subjectId: subject.id,
    label: subject.label,
    signals: signalsForSubject(normalized, subject.id),
    computedAt,
  });
}
