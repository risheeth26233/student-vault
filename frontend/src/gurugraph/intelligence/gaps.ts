// GuruGraph — learning gap foundation.
//
// Produces *candidate* findings with an explicit category so a potential
// learning gap can always be told apart from a confirmed misconception, low
// attendance, missing data or insufficient evidence. Misconception detection
// is intentionally NOT implemented here — that category stays reserved.

import type {
  EvidenceRef,
  GapCategory,
  GapSeverity,
  LearningGap,
  LearningSignal,
  NormalizedSignals,
} from '../domain/types';
import {
  GAP_DISCLAIMER,
  GAP_RULES,
  LOW_SCORE_THRESHOLD,
  roundScore,
} from '../domain/constants';
import { gapRecordId } from '../domain/ids';
import { isMasteryEvidence } from './mastery';

function severityForScore(value: number): GapSeverity {
  if (value < 0.4) return 'high';
  if (value < 0.5) return 'medium';
  return 'low';
}

function severityForShortfall(shortfallPercent: number): GapSeverity {
  if (shortfallPercent >= 20) return 'high';
  if (shortfallPercent >= 10) return 'medium';
  return 'low';
}

function distinguishersFor(category: GapCategory) {
  return {
    confirmedMisconception: category === 'confirmed_misconception',
    lowAttendance: category === 'low_attendance',
    missingData: category === 'missing_data',
    insufficientEvidence: category === 'insufficient_evidence',
  };
}

function makeGap(input: {
  category: GapCategory;
  scope: 'subject' | 'topic';
  subjectId: string;
  topicId: string | null;
  label: string;
  severity: GapSeverity;
  reason: string;
  detail: string;
  ruleId: string;
  evidence: EvidenceRef[];
  detectedAt: string;
}): LearningGap {
  return {
    id: gapRecordId(input.ruleId, input.topicId ?? input.subjectId),
    category: input.category,
    scope: input.scope,
    subjectId: input.subjectId,
    topicId: input.topicId,
    label: input.label,
    severity: input.severity,
    status: 'candidate',
    reason: input.reason,
    detail: input.detail,
    ruleId: input.ruleId,
    evidence: input.evidence,
    distinguishers: distinguishersFor(input.category),
    detectedAt: input.detectedAt,
    disclaimer: GAP_DISCLAIMER,
  };
}

function byId(a: LearningGap, b: LearningGap): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Topic-level gap candidates (low score, missing data, insufficient evidence). */
function topicGaps(normalized: NormalizedSignals, detectedAt: string): LearningGap[] {
  const gaps: LearningGap[] = [];

  for (const topic of normalized.topics) {
    const topicSignals = normalized.signals.filter((signal) => signal.topicId === topic.id);
    const evidence = topicSignals.filter(isMasteryEvidence);
    const assessments = evidence.filter(
      (signal): signal is LearningSignal & { outcome: { type: 'scored'; value: number } } =>
        signal.kind === 'assessment_result' && signal.outcome.type === 'scored'
    );

    const lowScoring = assessments.filter((signal) => signal.outcome.value < LOW_SCORE_THRESHOLD);

    if (lowScoring.length > 0) {
      const worst = lowScoring.reduce((min, signal) =>
        signal.outcome.value < min.outcome.value ? signal : min
      );
      gaps.push(
        makeGap({
          category: 'potential_learning_gap',
          scope: 'topic',
          subjectId: topic.subjectId,
          topicId: topic.id,
          label: topic.title,
          severity: severityForScore(worst.outcome.value),
          reason: `Recorded assessment below ${Math.round(LOW_SCORE_THRESHOLD * 100)}%`,
          detail: `Lowest recorded result is ${worst.outcome.raw} (${Math.round(
            worst.outcome.value * 100
          )}%) across ${lowScoring.length} assessment(s).`,
          ruleId: GAP_RULES.lowScore,
          evidence: lowScoring.map((signal) => signal.evidence),
          detectedAt,
        })
      );
      continue;
    }

    if (evidence.length === 0) {
      const hasContextOnly = topicSignals.length > 0;
      gaps.push(
        makeGap({
          category: hasContextOnly ? 'insufficient_evidence' : 'missing_data',
          scope: 'topic',
          subjectId: topic.subjectId,
          topicId: topic.id,
          label: topic.title,
          severity: 'unknown',
          reason: hasContextOnly
            ? 'Activity recorded but no measurable learning evidence yet'
            : 'No recorded signals for this topic',
          detail: hasContextOnly
            ? `${topicSignals.length} context signal(s) exist (attendance or attached resources) but no assessment, completion or checklist progress.`
            : 'The topic exists but has no assessment, assignment, checklist or resource records.',
          ruleId: hasContextOnly ? GAP_RULES.insufficientEvidence : GAP_RULES.missingData,
          evidence: topicSignals.map((signal) => signal.evidence),
          detectedAt,
        })
      );
    }
  }

  return gaps;
}

/** Subject-level attendance findings — explicitly NOT learning gaps. */
function attendanceGaps(normalized: NormalizedSignals, detectedAt: string): LearningGap[] {
  const gaps: LearningGap[] = [];

  for (const summary of normalized.attendance) {
    if (summary.rate === null || summary.total === 0) continue;
    const current = roundScore(summary.rate * 100);
    if (current >= summary.target) continue;
    const shortfall = roundScore(summary.target - current);
    gaps.push(
      makeGap({
        category: 'low_attendance',
        scope: 'subject',
        subjectId: summary.subjectId,
        topicId: null,
        label: summary.label,
        severity: severityForShortfall(shortfall),
        reason: 'Attendance below the target you set',
        detail: `Attendance is ${current}% against a ${summary.target}% target (${summary.present}/${summary.total} sessions). Participation context only — this is not a learning gap.`,
        ruleId: GAP_RULES.lowAttendance,
        evidence: summary.sourceIds.map((recordId) => ({
          sourceType: 'attendance' as const,
          sourceId: recordId,
          label: `Attendance: ${summary.label}`,
          detail: 'Session used for the attendance rate',
          observedAt: normalized.collectedAt,
        })),
        detectedAt,
      })
    );
  }

  return gaps;
}

/**
 * All candidate gap findings. Deterministic for a given normalized input.
 * `confirmed_misconception` is never produced — see GAP_RULES.
 */
export function detectLearningGaps(
  normalized: NormalizedSignals,
  detectedAt: string
): LearningGap[] {
  return [...topicGaps(normalized, detectedAt), ...attendanceGaps(normalized, detectedAt)].sort(
    byId
  );
}

/** Categories this foundation is allowed to emit (misconception stays reserved). */
export const EMITTABLE_GAP_CATEGORIES: readonly GapCategory[] = [
  'potential_learning_gap',
  'low_attendance',
  'missing_data',
  'insufficient_evidence',
];
