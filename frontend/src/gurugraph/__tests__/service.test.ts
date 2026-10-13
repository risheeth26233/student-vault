import { describe, expect, it } from 'vitest';
import { createGuruGraphService } from '../service/intelligenceService';
import { createMemoryStorage } from '../service/storage';
import { STORAGE_KEYS, GAP_RULES } from '../domain/constants';
import { gapRecordId, masteryRecordKey, subjectIdFromLabel } from '../domain/ids';
import type { GuruGraphDataSource, GuruGraphStorage } from '../domain/types';
import { AT, fixtureSource } from './fixtures';

type Storage = GuruGraphStorage;

function createService(storage: Storage = createMemoryStorage()) {
  const service = createGuruGraphService({ now: () => AT, storage });
  return { service, storage };
}

describe('intelligence service boundary', () => {
  it('requires ingest before compute and compute before retrieval', () => {
    const { service } = createService();

    expect(service.getSnapshot()).toBeNull();
    expect(service.getTopicIntelligence('topic-1')).toBeNull();
    expect(() => service.compute()).toThrow(/ingest\(\) must run/);

    service.ingest(fixtureSource());
    expect(() => service.getSubjectIntelligence('nope')).not.toThrow();
    service.compute();
    expect(service.getSnapshot()).not.toBeNull();
  });

  it('reports what it accepted from Student-Vault', () => {
    const { service } = createService();
    const report = service.ingest(fixtureSource());

    expect(report).toEqual({
      collectedAt: AT,
      accepted: {
        topics: 3,
        assessments: 2,
        assignments: 2,
        attendance: 1,
        resources: 1,
        subjects: 4,
      },
      signals: 10,
      skipped: [],
    });
  });

  it('retrieves topic, concept and subject intelligence', () => {
    const { service } = createService();
    service.ingest(fixtureSource());
    service.compute();

    const topic = service.getTopicIntelligence('topic-1');
    expect(topic?.topic.title).toBe('Quadratic Equations');
    expect(topic?.concepts.map((concept) => concept.id)).toEqual(['concept_topic_topic-1']);
    expect(topic?.mastery).toHaveLength(1);
    expect(topic?.gaps.map((gap) => gap.category)).toContain('potential_learning_gap');
    expect(topic?.signals.every((signal) => signal.topicId === 'topic-1')).toBe(true);

    const concept = service.getConceptIntelligence('concept_topic_topic-1');
    expect(concept?.concept.label).toBe('Quadratic Equations');
    expect(concept?.relationships).toEqual([]);
    expect(concept?.mastery[0]?.scope).toBe('concept');

    const subject = service.getSubjectIntelligence(subjectIdFromLabel('Physics'));
    expect(subject?.topics.map((topicItem) => topicItem.id)).toEqual(['topic-2']);
    expect(subject?.attendance?.target).toBe(75);
    expect(subject?.mastery.map((item) => item.scope)).toEqual(['concept', 'subject', 'topic'].sort());

    expect(service.getTopicIntelligence('unknown')).toBeNull();
    expect(service.getConceptIntelligence('unknown')).toBeNull();
    expect(service.getSubjectIntelligence('unknown')).toBeNull();
  });

  it('accepts invalid sources without throwing', () => {
    const { service } = createService();
    const report = service.ingest({
      topics: [{ nope: true }, null, undefined],
      assessments: 'not-an-array',
      assignments: {},
    } as unknown as GuruGraphDataSource);

    expect(report.signals).toBe(0);
    expect(report.accepted.topics).toBe(0);
    expect(service.compute().signals).toEqual([]);
  });

  it('persists intelligence for offline/local reuse', () => {
    const storage = createMemoryStorage();
    const first = createGuruGraphService({ now: () => AT, storage });
    first.ingest(fixtureSource());
    const snapshot = first.compute();

    const second = createGuruGraphService({ now: () => AT, storage });
    expect(second.getSnapshot()).toEqual(snapshot);
    expect(second.getTopicIntelligence('topic-1')?.topic.title).toBe('Quadratic Equations');
    expect(second.getNormalized()?.signals).toHaveLength(10);
  });

  it('survives corrupt persisted data', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.snapshot]: '{not json',
      [STORAGE_KEYS.relationships]: '[]',
    });
    const service = createGuruGraphService({ now: () => AT, storage });

    expect(service.getSnapshot()).toBeNull();
    expect(service.listRelationships()).toEqual([]);
    expect(() => service.ingest(fixtureSource())).not.toThrow();
  });

  it('clears intelligence and its storage', () => {
    const { service, storage } = createService();
    service.ingest(fixtureSource());
    service.compute();
    service.addRelationship({ fromConceptId: 'a', toConceptId: 'b', kind: 'related' });

    service.clear();

    expect(service.getSnapshot()).toBeNull();
    expect(service.getNormalized()).toBeNull();
    expect(service.listRelationships()).toEqual([]);
    expect(storage.get(STORAGE_KEYS.snapshot)).toBeNull();
    expect(storage.get(STORAGE_KEYS.relationships)).toBeNull();
  });

  it('only writes GuruGraph keys, never Student-Vault storage', () => {
    const written: string[] = [];
    const backing = createMemoryStorage();
    const spy = {
      get: (key: string) => backing.get(key),
      set: (key: string, value: string) => {
        written.push(key);
        backing.set(key, value);
      },
      remove: (key: string) => {
        written.push(key);
        backing.remove(key);
      },
    };

    const service = createGuruGraphService({ now: () => AT, storage: spy });
    service.ingest(fixtureSource());
    service.compute();

    expect(written.length).toBeGreaterThan(0);
    expect(written.every((key) => key.startsWith('gurugraph.'))).toBe(true);
    expect(written.some((key) => key.startsWith('sv_'))).toBe(false);
  });
});

describe('explainability', () => {
  function prepared() {
    const { service } = createService();
    service.ingest(fixtureSource());
    service.compute();
    return service;
  }

  it('explains a learning signal', () => {
    const explanation = prepared().explain('assessment_result:assessment-1');

    expect(explanation?.kind).toBe('signal');
    expect(explanation?.evidence).toHaveLength(1);
    expect(explanation?.evidence[0].sourceId).toBe('assessment-1');
    expect(explanation?.reasons.join(' ')).toContain('5/10');
  });

  it('explains a mastery record with its contributions', () => {
    const key = masteryRecordKey(subjectIdFromLabel('Mathematics'), { topicId: 'topic-1' });
    const explanation = prepared().explain(key);

    expect(explanation?.kind).toBe('mastery');
    expect(explanation?.reasons.some((reason) => reason.includes('gg.rule'))).toBe(true);
    expect(explanation?.reasons.some((reason) => reason.includes('Not a validated prediction'))).toBe(true);
    expect(explanation?.evidence.length).toBeGreaterThan(0);
  });

  it('explains a learning gap and names its rule', () => {
    const id = gapRecordId(GAP_RULES.lowScore, 'topic-1');
    const explanation = prepared().explain(id);

    expect(explanation?.kind).toBe('gap');
    expect(explanation?.reasons.join(' ')).toContain(GAP_RULES.lowScore);
    expect(explanation?.evidence.map((item) => item.sourceId)).toContain('assessment-1');
  });

  it('returns null for unknown records', () => {
    expect(prepared().explain('nope')).toBeNull();
  });
});
