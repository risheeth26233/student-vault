// Learning Insights view-model tests.
// Pure presentation logic over an intelligence snapshot produced by the real
// GuruGraph service — no DOM, no re-derivation.

import { describe, expect, it } from 'vitest';
import { createGuruGraphService } from '../../../gurugraph/service/intelligenceService';
import { createMemoryStorage } from '../../../gurugraph/service/storage';
import { subjectIdFromLabel, masteryRecordKey } from '../../../gurugraph/domain/ids';
import { EMITTABLE_GAP_CATEGORIES } from '../../../gurugraph/intelligence/gaps';
import { AT, fixtureSource } from '../../../gurugraph/__tests__/fixtures';
import {
  CONFIDENCE_LABEL,
  GAP_CATEGORY_PRESENTATION,
  MASTERY_LEVEL_PRESENTATION,
  SEVERITY_PRESENTATION,
  activeDistinguishers,
  buildInsightsViewModel,
  formatScorePercent,
} from '../insightsViewModel';

function snapshot() {
  const service = createGuruGraphService({ now: () => AT, storage: createMemoryStorage() });
  service.ingest(fixtureSource());
  return service.compute();
}

describe('presentation mappings', () => {
  it('labels every mastery level', () => {
    expect(Object.keys(MASTERY_LEVEL_PRESENTATION).sort()).toEqual(
      ['developing', 'emerging', 'insufficient_evidence', 'secure'].sort()
    );
    expect(MASTERY_LEVEL_PRESENTATION.secure.variant).toBe('success');
    expect(MASTERY_LEVEL_PRESENTATION.insufficient_evidence.variant).toBe('default');
  });

  it('labels every severity and gap category', () => {
    expect(Object.keys(SEVERITY_PRESENTATION).sort()).toEqual(['high', 'low', 'medium', 'unknown'].sort());
    expect(Object.keys(GAP_CATEGORY_PRESENTATION).sort()).toEqual(
      [
        'confirmed_misconception',
        'insufficient_evidence',
        'low_attendance',
        'missing_data',
        'potential_learning_gap',
      ].sort()
    );
    expect(CONFIDENCE_LABEL.none).toBe('No evidence');
  });

  it('formats a normalized score as a percentage', () => {
    expect(formatScorePercent(0.5)).toBe('50%');
    expect(formatScorePercent(0)).toBe('0%');
    expect(formatScorePercent(1)).toBe('100%');
  });
});

describe('buildInsightsViewModel', () => {
  it('selects topic-scope mastery with honest insufficient-evidence handling', () => {
    const vm = buildInsightsViewModel(snapshot());

    expect(vm.topics).toBe(3);
    expect(vm.subjects).toBe(4);
    expect(vm.topicMastery).toHaveLength(3);

    const quadraticKey = masteryRecordKey(subjectIdFromLabel('Mathematics'), { topicId: 'topic-1' });
    const quadratic = vm.topicMastery.find((item) => item.record.key === quadraticKey);
    expect(quadratic?.record.level).toBe('developing');
    expect(quadratic?.record.evidenceCount).toBe(3);
    expect(quadratic?.record.score).not.toBeNull();
    expect(quadratic?.subjectLabel).toBe('Mathematics');

    // topic-3 ("Moles") has no measurable evidence at all.
    const molesKey = masteryRecordKey(subjectIdFromLabel('Chemistry'), { topicId: 'topic-3' });
    const moles = vm.topicMastery.find((item) => item.record.key === molesKey);
    expect(moles?.record.level).toBe('insufficient_evidence');
    expect(moles?.record.score).toBeNull();

    expect(vm.topicsWithEvidence).toBe(2);
    expect(vm.topicsInsufficientEvidence).toBe(1);
    expect(vm.hasAnyRecords).toBe(true);
  });

  it('builds subject-scope overview records', () => {
    const vm = buildInsightsViewModel(snapshot());
    expect(vm.subjectMastery.map((item) => item.subjectLabel).sort()).toEqual([
      'Chemistry',
      'History',
      'Mathematics',
      'Physics',
    ]);
  });

  it('groups gaps by emittable category in stable order', () => {
    const vm = buildInsightsViewModel(snapshot());

    expect(vm.gapCount).toBe(3);
    expect(vm.potentialGapCount).toBe(1);
    // potential_learning_gap, low_attendance, missing_data present;
    // insufficient_evidence and confirmed_misconception are not.
    expect(vm.gapGroups.map((group) => group.category)).toEqual([
      'potential_learning_gap',
      'low_attendance',
      'missing_data',
    ]);
    // The order must follow EMITTABLE_GAP_CATEGORIES.
    const emittableOrder = EMITTABLE_GAP_CATEGORIES.filter((category) =>
      vm.gapGroups.some((group) => group.category === category)
    );
    expect(vm.gapGroups.map((group) => group.category)).toEqual(emittableOrder);
  });

  it('renders the full five-state legend and flags the reserved state', () => {
    const vm = buildInsightsViewModel(snapshot());

    expect(vm.supportedCategories).toHaveLength(5);
    const byCategory = new Map(vm.supportedCategories.map((item) => [item.category, item]));

    expect(byCategory.get('potential_learning_gap')?.emitted).toBe(true);
    expect(byCategory.get('low_attendance')?.emitted).toBe(true);
    expect(byCategory.get('missing_data')?.emitted).toBe(true);
    expect(byCategory.get('insufficient_evidence')?.emitted).toBe(false);

    const reserved = byCategory.get('confirmed_misconception');
    expect(reserved?.reserved).toBe(true);
    expect(reserved?.emitted).toBe(false);
  });

  it('exposes which of the five states a finding flags', () => {
    const vm = buildInsightsViewModel(snapshot());
    const missingData = vm.gapGroups
      .flatMap((group) => group.gaps)
      .find((gap) => gap.category === 'missing_data');
    expect(missingData).toBeDefined();
    expect(activeDistinguishers(missingData!)).toEqual(['missing data']);

    const lowAttendance = vm.gapGroups
      .flatMap((group) => group.gaps)
      .find((gap) => gap.category === 'low_attendance');
    expect(activeDistinguishers(lowAttendance!)).toEqual(['low attendance']);
  });

  it('returns an empty, non-claiming view for a null snapshot', () => {
    const vm = buildInsightsViewModel(null);

    expect(vm.topics).toBe(0);
    expect(vm.subjects).toBe(0);
    expect(vm.topicMastery).toEqual([]);
    expect(vm.subjectMastery).toEqual([]);
    expect(vm.gapGroups).toEqual([]);
    expect(vm.gapCount).toBe(0);
    expect(vm.hasAnyRecords).toBe(false);
    // The legend still explains all five states, none present.
    expect(vm.supportedCategories).toHaveLength(5);
    expect(vm.supportedCategories.every((item) => !item.emitted)).toBe(true);
  });
});
