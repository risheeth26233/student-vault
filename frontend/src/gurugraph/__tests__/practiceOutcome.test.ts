// Test N (part 2) — Phase 3 practice evidence flows into GuruGraph as a new
// `practice_outcome` signal kind WITHOUT changing Phase 2 classification
// meanings: excluded kinds, weights of existing kinds and the accepted-count
// report shape all stay exactly as they were.

import { describe, expect, it } from 'vitest';
import { normalizeLearningSignals } from '../signals/normalize';
import { MASTERY_EXCLUDED_KINDS, SIGNAL_WEIGHTS } from '../domain/constants';
import { createGuruGraphService } from '../service/intelligenceService';
import { createMemoryStorage } from '../service/storage';
import type { GuruGraphDataSource } from '../domain/types';
import { AT, makeTopic } from './fixtures';

function topicIdFor(): string {
  const first = normalizeLearningSignals({ topics: [makeTopic()] }, AT);
  return first.topics[0].id;
}

const HANDWRITING_EVIDENCE = (topicId: string) => ({
  id: 'hws-1:attempt:att-1',
  topicId,
  observedAt: AT,
  kind: 'practice',
  outcome: 'correct',
  label: 'Practice attempt: Quadratic Equations',
  detail: 'Coverage check passed (80%)',
});

describe('practice_outcome signal normalization', () => {
  it('turns slim handwritten evidence into practice_outcome signals on the right topic', () => {
    const topicId = topicIdFor();
    const base = normalizeLearningSignals({ topics: [makeTopic()] }, AT);
    const normalized = normalizeLearningSignals(
      { topics: [makeTopic()], handwriting: [HANDWRITING_EVIDENCE(topicId)] },
      AT
    );

    const signal = normalized.signals.find((entry) => entry.kind === 'practice_outcome');
    expect(signal).toBeDefined();
    expect(signal?.topicId).toBe(topicId);
    expect(signal?.subjectId).toBe(base.topics[0].subjectId);
    expect(signal?.outcome).toEqual({ type: 'binary', value: 1, raw: 'Coverage check passed (80%)' });
    expect(signal?.weight).toBe(SIGNAL_WEIGHTS.practice_outcome);
    expect(signal?.evidence.sourceType).toBe('handwriting');
    expect(signal?.evidence.observedAt).toBe(AT);
  });

  it('records ungraded evidence with outcome none — visible but non-moving', () => {
    const topicId = topicIdFor();
    const normalized = normalizeLearningSignals(
      {
        topics: [makeTopic()],
        handwriting: [{ ...HANDWRITING_EVIDENCE(topicId), outcome: 'ungraded', detail: 'Answer recorded without an automatic check' }],
      },
      AT
    );
    const signal = normalized.signals.find((entry) => entry.kind === 'practice_outcome');
    expect(signal?.outcome.type).toBe('none');
  });

  it('skips invalid handwriting records with distinguishable reasons', () => {
    const topicId = topicIdFor();
    const normalized = normalizeLearningSignals(
      {
        topics: [makeTopic()],
        handwriting: [
          { ...HANDWRITING_EVIDENCE(topicId), topicId: 'unknown-topic' },
          { ...HANDWRITING_EVIDENCE(topicId), outcome: 'maybe' },
          { ...HANDWRITING_EVIDENCE(topicId), observedAt: 'not-a-date' },
          { id: '', topicId, observedAt: AT, outcome: 'correct' },
        ],
      },
      AT
    );
    expect(normalized.signals.some((entry) => entry.kind === 'practice_outcome')).toBe(false);
    const reasons = normalized.skipped.map((entry) => entry.reason);
    expect(reasons).toContain('unknown_topic');
    expect(reasons).toContain('invalid_status');
    expect(reasons).toContain('invalid_date');
    expect(reasons).toContain('missing_id');
    expect(normalized.skipped.every((entry) => entry.sourceType === 'handwriting')).toBe(true);
  });

  it('never derives or mutates Student-Vault data (read-only pass)', () => {
    const source: GuruGraphDataSource = {
      topics: [makeTopic()],
      handwriting: [HANDWRITING_EVIDENCE(topicIdFor())],
    };
    const before = JSON.stringify(source);
    normalizeLearningSignals(source, AT);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('Phase 2 meanings stay unchanged', () => {
  it('practice_outcome is a graded kind and is NOT mastery-excluded', () => {
    expect(SIGNAL_WEIGHTS.practice_outcome).toBe(0.7);
    expect(MASTERY_EXCLUDED_KINDS).toEqual(['attendance_session', 'resource_activity']);
    expect(MASTERY_EXCLUDED_KINDS).not.toContain('practice_outcome');
  });

  it('keeps every pre-existing signal weight exactly as it was', () => {
    expect(SIGNAL_WEIGHTS.assessment_result).toBe(1);
    expect(SIGNAL_WEIGHTS.assignment_outcome).toBe(0.5);
    expect(SIGNAL_WEIGHTS.study_activity).toBe(0.6);
    expect(SIGNAL_WEIGHTS.attendance_session).toBe(0.3);
    expect(SIGNAL_WEIGHTS.resource_activity).toBe(0.2);
  });

  it('keeps the IngestReport accepted-count shape identical (no new keys)', () => {
    const service = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
    const report = service.ingest({
      topics: [makeTopic()],
      handwriting: [HANDWRITING_EVIDENCE(topicIdFor())],
    });
    expect(Object.keys(report.accepted).sort()).toEqual([
      'assessments',
      'assignments',
      'attendance',
      'resources',
      'subjects',
      'topics',
    ]);
    // The evidence still lands in the normalized signal total.
    expect(report.signals).toBeGreaterThan(0);
  });
});

describe('end-to-end through the intelligence service', () => {
  it('contributes practice evidence to topic mastery with honest confidence', () => {
    const topicId = topicIdFor();
    const service = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
    service.ingest({ topics: [makeTopic()], handwriting: [HANDWRITING_EVIDENCE(topicId)] });
    const snapshot = service.compute();

    const topicRecord = snapshot.mastery.find(
      (record) => record.scope === 'topic' && record.topicId === topicId
    );
    expect(topicRecord).toBeDefined();
    expect(topicRecord?.contributingKinds).toContain('practice_outcome');
    // makeTopic also contributes its own study signal, so the record carries at
    // least the topic signal plus this practice outcome.
    expect(topicRecord?.evidenceCount).toBeGreaterThanOrEqual(2);
    // Fewer than 4 observations can never report high confidence.
    expect(topicRecord?.confidence).not.toBe('high');
    expect(topicRecord?.disclaimer.length).toBeGreaterThan(0);
    expect(topicRecord?.ruleId).toBeTruthy();
  });

  it('a single ungraded observation contributes nothing to mastery', () => {
    const topicId = topicIdFor();

    const baselineService = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
    baselineService.ingest({ topics: [makeTopic()] });
    const baseline = baselineService.compute();

    const ungradedService = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
    ungradedService.ingest({
      topics: [makeTopic()],
      handwriting: [
        { ...HANDWRITING_EVIDENCE(topicId), outcome: 'ungraded', detail: 'Answer recorded without an automatic check' },
      ],
    });
    const withUngraded = ungradedService.compute();

    const record = (snapshot: typeof baseline) =>
      snapshot.mastery.find((entry) => entry.scope === 'topic' && entry.topicId === topicId);
    const before = record(baseline);
    const after = record(withUngraded);

    expect(before).toBeDefined();
    expect(after).toBeDefined();
    // The ungraded observation is visible as evidence in the pipeline but must
    // not change the mastery estimate in any way.
    expect(after?.score).toBe(before?.score);
    expect(after?.evidenceCount).toBe(before?.evidenceCount);
    expect(after?.contributingKinds).not.toContain('practice_outcome');
    expect(withUngraded.signals.some((signal) => signal.kind === 'practice_outcome')).toBe(true);
  });
});
