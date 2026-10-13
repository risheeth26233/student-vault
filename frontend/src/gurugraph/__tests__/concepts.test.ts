import { describe, expect, it } from 'vitest';
import { normalizeLearningSignals } from '../signals/normalize';
import { conceptIdFromTopic, subjectIdFromLabel } from '../domain/ids';
import { createMemoryStorage } from '../service/storage';
import { createGuruGraphService } from '../service/intelligenceService';
import { AT, fixtureSource, makeTopic } from './fixtures';

describe('concept representation', () => {
  it('derives one concept per topic without inventing concepts', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);

    expect(normalized.concepts).toHaveLength(normalized.topics.length);
    expect(normalized.concepts.map((concept) => concept.id).sort()).toEqual([
      'concept_topic_topic-1',
      'concept_topic_topic-2',
      'concept_topic_topic-3',
    ]);

    const quadratic = normalized.concepts.find((concept) => concept.id === conceptIdFromTopic('topic-1'));
    expect(quadratic).toEqual({
      id: 'concept_topic_topic-1',
      subjectId: subjectIdFromLabel('Mathematics'),
      label: 'Quadratic Equations',
      topicIds: ['topic-1'],
      origin: 'topic_derived',
    });
  });

  it('scopes concepts to their subject', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    const kinematics = normalized.concepts.find((concept) => concept.id === 'concept_topic_topic-2');
    const physicsTopic = normalized.topics.find((topic) => topic.id === 'topic-2');

    expect(kinematics?.subjectId).toBe(physicsTopic?.subjectId);
  });

  it('leaves relationships empty until a human or curator adds them', () => {
    const normalized = normalizeLearningSignals(fixtureSource(), AT);
    expect(normalized.relationships).toEqual([]);
  });

  it('ignores topics without a subject instead of creating orphan concepts', () => {
    const normalized = normalizeLearningSignals(
      { topics: [makeTopic({ id: 'orphan', subject: '   ' })] },
      AT
    );
    expect(normalized.concepts).toEqual([]);
  });
});

describe('relationship representation', () => {
  it('accepts and persists a manually recorded relationship', () => {
    const storage = createMemoryStorage();
    const service = createGuruGraphService({ now: () => AT, storage });
    service.ingest(fixtureSource());
    service.compute();

    const relationship = service.addRelationship({
      fromConceptId: 'concept_topic_topic-2',
      toConceptId: 'concept_topic_topic-1',
      kind: 'prerequisite',
      note: 'Kinematics assumes algebraic fluency',
    });

    expect(relationship).toEqual({
      id: 'concept_topic_topic-2->concept_topic_topic-1#prerequisite',
      fromConceptId: 'concept_topic_topic-2',
      toConceptId: 'concept_topic_topic-1',
      kind: 'prerequisite',
      origin: 'manual',
      note: 'Kinematics assumes algebraic fluency',
      createdAt: AT,
    });
    expect(service.listRelationships()).toHaveLength(1);
    expect(service.getSnapshot()?.relationships).toHaveLength(1);

    const restored = createGuruGraphService({ now: () => AT, storage });
    expect(restored.listRelationships()).toEqual([relationship]);
  });

  it('rejects invalid relationships', () => {
    const service = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });

    expect(() =>
      service.addRelationship({ fromConceptId: 'a', toConceptId: 'a', kind: 'related' })
    ).toThrow(/cannot relate to itself/);
    expect(() =>
      service.addRelationship({ fromConceptId: 'a', toConceptId: 'b', kind: 'unrelated' as never })
    ).toThrow(/unsupported relationship kind/);
    expect(() => service.addRelationship({ fromConceptId: '', toConceptId: 'b', kind: 'related' })).toThrow(
      /both concept ids are required/
    );

    service.addRelationship({ fromConceptId: 'a', toConceptId: 'b', kind: 'related' });
    expect(() => service.addRelationship({ fromConceptId: 'a', toConceptId: 'b', kind: 'related' })).toThrow(
      /already exists/
    );
    expect(service.removeRelationship('missing')).toBe(false);
    expect(service.removeRelationship('a->b#related')).toBe(true);
    expect(service.listRelationships()).toEqual([]);
  });
});
