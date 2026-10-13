// Learning Insights — presentation view-model.
//
// Pure functions that SELECT, GROUP and LABEL records the GuruGraph
// intelligence layer already produced. This module never re-derives mastery,
// gap categories, thresholds or deterministic ids — those live in
// `src/gurugraph` and are consumed here verbatim. Keeping the view-model pure
// makes it trivially testable and guarantees the UI cannot invent conclusions
// the intelligence layer did not reach.

import type {
  EvidenceConfidence,
  GapCategory,
  GapDistinguishers,
  GapSeverity,
  IntelligenceSnapshot,
  LearningGap,
  LearningSignalKind,
  MasteryLevel,
  MasteryRecord,
} from '../../types/gurugraph';
import { EMITTABLE_GAP_CATEGORIES } from '../../gurugraph';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

/** Presentation mapping for the four mastery levels a record can carry. */
export const MASTERY_LEVEL_PRESENTATION: Record<
  MasteryLevel,
  { label: string; variant: BadgeVariant }
> = {
  insufficient_evidence: { label: 'Insufficient evidence', variant: 'default' },
  emerging: { label: 'Emerging', variant: 'danger' },
  developing: { label: 'Developing', variant: 'warning' },
  secure: { label: 'Secure', variant: 'success' },
};

export const CONFIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  none: 'No evidence',
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const SEVERITY_PRESENTATION: Record<GapSeverity, { label: string; variant: BadgeVariant }> = {
  unknown: { label: 'Unknown severity', variant: 'default' },
  low: { label: 'Low', variant: 'info' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
};

/**
 * Human wording for the five gap states. `confirmed_misconception` is shown in
 * the legend but is reserved for a future engine and is never emitted here.
 */
export const GAP_CATEGORY_PRESENTATION: Record<
  GapCategory,
  { label: string; description: string; variant: BadgeVariant }
> = {
  potential_learning_gap: {
    label: 'Potential learning gap',
    description:
      'A recorded assessment scored below the threshold. A candidate to review — not a diagnosis.',
    variant: 'danger',
  },
  low_attendance: {
    label: 'Low attendance',
    description:
      'Attendance is below the target you set. Participation context — not evidence of learning.',
    variant: 'warning',
  },
  missing_data: {
    label: 'Missing data',
    description: 'The topic exists but nothing measurable has been recorded against it yet.',
    variant: 'default',
  },
  insufficient_evidence: {
    label: 'Insufficient evidence',
    description:
      'Some activity exists but there is not enough measurable evidence to judge mastery.',
    variant: 'default',
  },
  confirmed_misconception: {
    label: 'Confirmed misconception',
    description:
      'Reserved for a future engine. This foundation never produces this state, so it is never shown as a finding.',
    variant: 'default',
  },
};

export const SIGNAL_KIND_LABEL: Record<LearningSignalKind, string> = {
  assessment_result: 'Assessment result',
  assignment_outcome: 'Assignment outcome',
  attendance_session: 'Attendance session',
  study_activity: 'Study activity',
  resource_activity: 'Resource activity',
};

const DISTINGUISHER_LABEL: Record<keyof GapDistinguishers, string> = {
  confirmedMisconception: 'confirmed misconception',
  lowAttendance: 'low attendance',
  missingData: 'missing data',
  insufficientEvidence: 'insufficient evidence',
};

/** Which of the five states a finding actively flags (keeps them distinguishable). */
export function activeDistinguishers(gap: LearningGap): string[] {
  return (Object.keys(DISTINGUISHER_LABEL) as (keyof GapDistinguishers)[])
    .filter((key) => gap.distinguishers[key])
    .map((key) => DISTINGUISHER_LABEL[key]);
}

/** Format a normalized 0..1 score as a whole percentage. */
export function formatScorePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export interface MasteryView {
  record: MasteryRecord;
  subjectLabel: string;
}

export interface GapCategoryGroup {
  category: GapCategory;
  label: string;
  description: string;
  variant: BadgeVariant;
  gaps: LearningGap[];
}

export interface SupportedCategoryView {
  category: GapCategory;
  label: string;
  description: string;
  /** True when this category is present in the current snapshot. */
  emitted: boolean;
  /** True for the reserved misconception state, which is never a finding. */
  reserved: boolean;
}

export interface InsightsViewModel {
  subjects: number;
  topics: number;
  signals: number;
  topicMastery: MasteryView[];
  subjectMastery: MasteryView[];
  gapGroups: GapCategoryGroup[];
  gapCount: number;
  potentialGapCount: number;
  topicsWithEvidence: number;
  topicsInsufficientEvidence: number;
  supportedCategories: SupportedCategoryView[];
  hasAnyRecords: boolean;
}

function byRecordLabel(
  a: { record: { label: string } },
  b: { record: { label: string } }
): number {
  return a.record.label.localeCompare(b.record.label);
}

/** Build the read-only view the Learning Insights page renders. */
export function buildInsightsViewModel(snapshot: IntelligenceSnapshot | null): InsightsViewModel {
  const subjectLabels = new Map<string, string>();
  for (const subject of snapshot?.subjects ?? []) {
    subjectLabels.set(subject.id, subject.label);
  }
  const labelForSubject = (id: string): string => subjectLabels.get(id) ?? 'Unknown subject';

  const mastery = snapshot?.mastery ?? [];
  const topicRecords = mastery.filter((record) => record.scope === 'topic');
  const subjectRecords = mastery.filter((record) => record.scope === 'subject');

  const topicMastery: MasteryView[] = topicRecords
    .map((record) => ({ record, subjectLabel: labelForSubject(record.subjectId) }))
    .sort(
      (a, b) => byRecordLabel(a, b) || a.record.key.localeCompare(b.record.key)
    );

  const subjectMastery: MasteryView[] = subjectRecords
    .map((record) => ({ record, subjectLabel: labelForSubject(record.subjectId) }))
    .sort((a, b) => byRecordLabel(a, b));

  const gaps = snapshot?.gaps ?? [];
  const presentCategories = new Set(gaps.map((gap) => gap.category));

  // Only surface the states this engine can actually emit, in a stable order.
  const gapGroups: GapCategoryGroup[] = [];
  for (const category of EMITTABLE_GAP_CATEGORIES) {
    const inCategory = gaps.filter((gap) => gap.category === category);
    if (inCategory.length === 0) continue;
    const presentation = GAP_CATEGORY_PRESENTATION[category];
    gapGroups.push({
      category,
      label: presentation.label,
      description: presentation.description,
      variant: presentation.variant,
      gaps: inCategory,
    });
  }

  // The full five-state legend, including the reserved misconception state.
  const allCategories: GapCategory[] = [...EMITTABLE_GAP_CATEGORIES, 'confirmed_misconception'];
  const supportedCategories: SupportedCategoryView[] = allCategories.map((category) => ({
    category,
    label: GAP_CATEGORY_PRESENTATION[category].label,
    description: GAP_CATEGORY_PRESENTATION[category].description,
    emitted: presentCategories.has(category),
    reserved: category === 'confirmed_misconception',
  }));

  const topicsWithEvidence = topicRecords.filter(
    (record) => record.level !== 'insufficient_evidence'
  ).length;

  return {
    subjects: snapshot?.subjects.length ?? 0,
    topics: snapshot?.topics.length ?? 0,
    signals: snapshot?.signals.length ?? 0,
    topicMastery,
    subjectMastery,
    gapGroups,
    gapCount: gaps.length,
    potentialGapCount: gaps.filter((gap) => gap.category === 'potential_learning_gap').length,
    topicsWithEvidence,
    topicsInsufficientEvidence: topicRecords.length - topicsWithEvidence,
    supportedCategories,
    hasAnyRecords: (snapshot?.topics.length ?? 0) > 0 || (snapshot?.subjects.length ?? 0) > 0,
  };
}
