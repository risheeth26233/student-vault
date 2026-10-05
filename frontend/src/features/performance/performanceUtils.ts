// Academic Performance helpers — labels, scoring, validation and summaries
// shared by the performance page, the form dialog and the dashboard widget.

import type {
  Assessment,
  AssessmentCreate,
  AssessmentType,
} from '../../types/api';

/** Normalised form values shared by the assessment dialog and the page. */
export interface AssessmentFormValues {
  title: string;
  subject: string;
  topicId: string | null;
  type: AssessmentType;
  /** Raw text so the input can be edited freely; validated on submit. */
  score: string;
  maxScore: string;
  /** `YYYY-MM-DD` value for `<input type="date">`. */
  date: string;
}

export const TYPE_OPTIONS: AssessmentType[] = ['quiz', 'test', 'exam', 'assignment', 'other'];

interface Meta {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const TYPE_META: Record<AssessmentType, Meta> = {
  quiz: { label: 'Quiz', variant: 'info' },
  test: { label: 'Test', variant: 'info' },
  exam: { label: 'Exam', variant: 'default' },
  assignment: { label: 'Assignment', variant: 'default' },
  other: { label: 'Other', variant: 'default' },
};

export function typeLabel(type: AssessmentType): string {
  return (TYPE_META[type] ?? TYPE_META.other).label;
}

export function typeVariant(type: AssessmentType): Meta['variant'] {
  return (TYPE_META[type] ?? TYPE_META.other).variant;
}

export function percentageOf(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score * 1000) / maxScore) / 10 : 0;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export type ScoreKind = 'excellent' | 'good' | 'fair' | 'weak';

export interface ScoreBand {
  kind: ScoreKind;
  label: string;
  variant: Meta['variant'];
}

export function scoreBand(percentage: number): ScoreBand {
  if (percentage >= 85) return { kind: 'excellent', label: 'Excellent', variant: 'success' };
  if (percentage >= 70) return { kind: 'good', label: 'Good', variant: 'info' };
  if (percentage >= 50) return { kind: 'fair', label: 'Fair', variant: 'warning' };
  return { kind: 'weak', label: 'Needs work', variant: 'danger' };
}

/** `YYYY-MM-DD` value for `<input type="date">` from an ISO string. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO string (UTC) from a date input value, keeping the picked calendar day. */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function todayDateInput(): string {
  return isoToDateInput(new Date().toISOString());
}

export function toCreatePayload(values: AssessmentFormValues): AssessmentCreate {
  const maxScore = Number(values.maxScore);
  const score = Number(values.score);
  return {
    title: values.title.trim(),
    subject: values.subject.trim(),
    topicId: values.topicId,
    type: values.type,
    score,
    maxScore,
    date: dateInputToIso(values.date) ?? new Date().toISOString(),
  };
}

export function toUpdatePayload(values: AssessmentFormValues): AssessmentCreate {
  return toCreatePayload(values);
}

export function toFormValues(assessment: Assessment | null): AssessmentFormValues {
  if (!assessment) {
    return {
      title: '',
      subject: '',
      topicId: null,
      type: 'exam',
      score: '',
      maxScore: '',
      date: todayDateInput(),
    };
  }
  return {
    title: assessment.title,
    subject: assessment.subject,
    topicId: assessment.topicId,
    type: assessment.type,
    score: String(assessment.score),
    maxScore: String(assessment.maxScore),
    date: isoToDateInput(assessment.date),
  };
}

/** Returns an error message, or null when the form is valid. */
export function validateAssessmentValues(values: AssessmentFormValues): string | null {
  const title = values.title.trim();
  const subject = values.subject.trim();

  if (!title) return 'Enter a title for the record.';
  if (title.length > 120) return 'Title must be 120 characters or fewer.';
  if (!subject) return 'Enter a subject for the record.';
  if (subject.length > 40) return 'Subject must be 40 characters or fewer.';

  if (!values.score.trim()) return 'Enter the score you achieved.';
  const score = Number(values.score);
  if (!Number.isInteger(score) || score < 0) return 'Score must be a whole number of 0 or more.';

  if (!values.maxScore.trim()) return 'Enter the maximum possible score.';
  const maxScore = Number(values.maxScore);
  if (!Number.isInteger(maxScore) || maxScore < 1) {
    return 'Maximum score must be a whole number of at least 1.';
  }

  if (score > maxScore) return 'Score cannot be higher than the maximum score.';
  if (!values.date) return 'Enter the date of the assessment.';
  if (Number.isNaN(new Date(`${values.date}T00:00:00`).getTime())) return 'Enter a valid date.';

  return null;
}

export function assessmentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'record' : 'records'}`;
}

// ---------------------------------------------------------------------------
// Summaries (subject breakdowns + trend) — descriptive statistics only
// ---------------------------------------------------------------------------

export interface SubjectSummary {
  subject: string;
  count: number;
  /** Mean of the record percentages (0 when there are no records). */
  average: number;
  best: number;
  latestDate: string | null;
}

export interface TrendPoint {
  id: string;
  date: string;
  percentage: number;
  title: string;
  subject: string;
}

export interface PerformanceSummary {
  count: number;
  average: number;
  highest: number;
  lowest: number;
  subjects: SubjectSummary[];
  /** Oldest → newest, capped for the sparkline. */
  trend: TrendPoint[];
}

export const TREND_LIMIT = 12;

export function sortNewestFirst(assessments: Assessment[]): Assessment[] {
  return [...assessments].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Pure descriptive summary of the given records: averages, per-subject
 * breakdown and a chronological trend. No predictions or AI conclusions.
 */
export function computeSummary(assessments: Assessment[]): PerformanceSummary {
  if (assessments.length === 0) {
    return { count: 0, average: 0, highest: 0, lowest: 0, subjects: [], trend: [] };
  }

  const bySubject = new Map<string, Assessment[]>();
  let total = 0;
  let highest = assessments[0].percentage;
  let lowest = assessments[0].percentage;

  for (const assessment of assessments) {
    total += assessment.percentage;
    if (assessment.percentage > highest) highest = assessment.percentage;
    if (assessment.percentage < lowest) lowest = assessment.percentage;

    const list = bySubject.get(assessment.subject) ?? [];
    list.push(assessment);
    bySubject.set(assessment.subject, list);
  }

  const subjects: SubjectSummary[] = [...bySubject.entries()]
    .map(([subject, records]) => {
      const sum = records.reduce((acc, item) => acc + item.percentage, 0);
      const newest = sortNewestFirst(records)[0];
      return {
        subject,
        count: records.length,
        average: Math.round((sum / records.length) * 10) / 10,
        best: Math.max(...records.map((item) => item.percentage)),
        latestDate: newest?.date ?? null,
      };
    })
    .sort((a, b) => b.average - a.average || a.subject.localeCompare(b.subject));

  const trend = sortNewestFirst(assessments)
    .slice(0, TREND_LIMIT)
    .reverse()
    .map((item) => ({
      id: item.id,
      date: item.date,
      percentage: item.percentage,
      title: item.title,
      subject: item.subject,
    }));

  return {
    count: assessments.length,
    average: Math.round((total / assessments.length) * 10) / 10,
    highest,
    lowest,
    subjects,
    trend,
  };
}
