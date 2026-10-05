// Search helpers — scope labels, token matching and result grouping for the
// unified Phase 1 search foundation (vault content + web + videos).

import type { Assessment, Assignment, Resource, Topic } from '../../types/api';

export const SEARCH_SCOPES = ['vault', 'web', 'videos'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const SCOPE_LABELS: Record<SearchScope, string> = {
  vault: 'My Vault',
  web: 'Web',
  videos: 'Videos',
};

export function normalizeScope(value: string | null | undefined): SearchScope {
  return SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : 'vault';
}

/** Split a query into lowercase tokens (whitespace separated, deduplicated). */
export function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

/** Every token must appear in the haystack (case-insensitive substring match). */
export function matches(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const needle = haystack.toLowerCase();
  return tokens.every((token) => needle.includes(token));
}

export type VaultResultKind =
  | 'subject'
  | 'topic'
  | 'note'
  | 'document'
  | 'assignment'
  | 'performance'
  | 'attendance';

export interface VaultResult {
  id: string;
  kind: VaultResultKind;
  title: string;
  subtitle?: string;
  snippet?: string;
  href: string;
}

export interface VaultResultGroup {
  kind: VaultResultKind;
  label: string;
  items: VaultResult[];
}

export const KIND_LABELS: Record<VaultResultKind, string> = {
  subject: 'Subjects',
  topic: 'Topics',
  note: 'Notes',
  document: 'Documents',
  assignment: 'Assignments',
  performance: 'Performance',
  attendance: 'Attendance',
};

export const KIND_ORDER: VaultResultKind[] = [
  'subject',
  'topic',
  'note',
  'document',
  'assignment',
  'performance',
  'attendance',
];

function excerpt(notes: string, tokens: string[], length = 140): string | undefined {
  const text = notes.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const lower = text.toLowerCase();
  const hit = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const start = Math.max(0, (hit ?? 0) - Math.floor(length / 3));
  const slice = text.slice(start, start + length).trim();
  return `${start > 0 ? '…' : ''}${slice}${start + length < text.length ? '…' : ''}`;
}

export interface VaultSearchInput {
  query: string;
  topics: Topic[];
  subjects: string[];
  resources: Resource[];
  assignments: Assignment[];
  assessments: Assessment[];
  attendanceSubjects: string[];
}

export const VAULT_GROUP_ORDER = KIND_ORDER;

/** Filter every vault entity against the query and group the hits by kind. */
export function searchVault(input: VaultSearchInput): VaultResultGroup[] {
  const tokens = tokenize(input.query);
  if (tokens.length === 0) return [];

  const results: Record<VaultResultKind, VaultResult[]> = {
    subject: [],
    topic: [],
    note: [],
    document: [],
    assignment: [],
    performance: [],
    attendance: [],
  };

  for (const subject of input.subjects) {
    if (matches(subject, tokens)) {
      results.subject.push({
        id: `subject-${subject}`,
        kind: 'subject',
        title: subject,
        subtitle: `${input.topics.filter((topic) => topic.subject === subject).length} topics`,
        href: `/vault?subject=${encodeURIComponent(subject)}`,
      });
    }
  }

  for (const topic of input.topics) {
    const haystack = `${topic.subject} ${topic.title} ${topic.status}`;
    if (matches(haystack, tokens)) {
      results.topic.push({
        id: `topic-${topic.id}`,
        kind: 'topic',
        title: topic.title,
        subtitle: topic.subject,
        snippet: excerpt(topic.notes, tokens),
        href: `/vault?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.id)}`,
      });
    }
    if (topic.notes.trim() && matches(topic.notes, tokens)) {
      results.note.push({
        id: `note-${topic.id}`,
        kind: 'note',
        title: topic.title,
        subtitle: topic.subject,
        snippet: excerpt(topic.notes, tokens),
        href: `/vault?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.id)}`,
      });
    }
  }

  for (const resource of input.resources) {
    const topic = input.topics.find((item) => item.id === resource.topicId);
    const haystack = `${resource.name} ${topic?.subject ?? ''} ${topic?.title ?? ''}`;
    if (matches(haystack, tokens)) {
      results.document.push({
        id: `document-${resource.id}`,
        kind: 'document',
        title: resource.name,
        subtitle: topic ? `${topic.subject} — ${topic.title}` : 'Unlinked resource',
        href: '/documents',
      });
    }
  }

  for (const assignment of input.assignments) {
    const haystack = `${assignment.title} ${assignment.subject} ${assignment.description}`;
    if (matches(haystack, tokens)) {
      results.assignment.push({
        id: `assignment-${assignment.id}`,
        kind: 'assignment',
        title: assignment.title,
        subtitle: assignment.subject,
        snippet: excerpt(assignment.description, tokens),
        href: assignment.status === 'completed' ? '/assignments?status=completed' : '/assignments',
      });
    }
  }

  for (const assessment of input.assessments) {
    const haystack = `${assessment.title} ${assessment.subject} ${assessment.type}`;
    if (matches(haystack, tokens)) {
      results.performance.push({
        id: `performance-${assessment.id}`,
        kind: 'performance',
        title: assessment.title,
        subtitle: `${assessment.subject} • ${assessment.percentage}%`,
        href: `/performance?subject=${encodeURIComponent(assessment.subject)}`,
      });
    }
  }

  for (const subject of input.attendanceSubjects) {
    if (matches(subject, tokens)) {
      results.attendance.push({
        id: `attendance-${subject}`,
        kind: 'attendance',
        title: subject,
        href: '/attendance',
      });
    }
  }

  return VAULT_GROUP_ORDER
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      items: results[kind].slice(0, 25),
    }))
    .filter((group) => group.items.length > 0);
}

export function countResults(groups: VaultResultGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}
