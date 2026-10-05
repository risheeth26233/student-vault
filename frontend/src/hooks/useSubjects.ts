// Subjects are derived from Topic.subject — there is no separate subject table.
// A small local registry keeps subjects that exist before their first topic and
// survives when every topic of a subject is removed; topic data itself always
// lives in the backend (or the local topic store while offline).

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAllTopics, topicsKey } from './useTopics';
import { updateTopic, deleteTopic } from '../services/topicStore';
import type { Topic } from '../types/api';

const registryKey = ['subjects', 'registry'] as const;
const STORAGE_KEY = 'sv_subjects';

/** Matches the backend constraint on Topic.subject (VarChar(40)). */
export const SUBJECT_MAX_LENGTH = 40;

export interface SubjectMeta {
  name: string;
  topicCount: number;
}

function loadRegistry(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function saveRegistry(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Failed to save subjects:', error);
  }
}

export function useSubjectRegistry() {
  return useQuery({
    queryKey: registryKey,
    queryFn: () => loadRegistry(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** All subjects (registry + subjects that own at least one topic) with counts. */
export function useSubjects(): SubjectMeta[] {
  const { data: registry } = useSubjectRegistry();
  const { data: allTopics } = useAllTopics();

  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const topic of allTopics?.topics ?? []) {
      counts.set(topic.subject, (counts.get(topic.subject) ?? 0) + 1);
    }
    const names = new Set<string>([...(registry ?? []), ...counts.keys()]);
    return [...names]
      .map((name) => ({ name, topicCount: counts.get(name) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [registry, allTopics]);
}

/** Group topics by subject. */
export function groupTopicsBySubject(topics: Topic[]): Map<string, Topic[]> {
  const bySubject = new Map<string, Topic[]>();
  for (const topic of topics) {
    const list = bySubject.get(topic.subject) ?? [];
    list.push(topic);
    bySubject.set(topic.subject, list);
  }
  return bySubject;
}

export function useTopicsBySubject(topics: Topic[]): Map<string, Topic[]> {
  return useMemo(() => groupTopicsBySubject(topics), [topics]);
}

export function validateSubjectName(
  name: string,
  existing: string[],
  options: { exclude?: string } = {}
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a subject name.';
  if (trimmed.length > SUBJECT_MAX_LENGTH) return `Subject names are limited to ${SUBJECT_MAX_LENGTH} characters.`;

  const exclude = options.exclude?.trim().toLowerCase();
  const duplicate = existing.some(
    (item) => item.toLowerCase() === trimmed.toLowerCase() && item.toLowerCase() !== exclude
  );
  if (duplicate) return 'A subject with that name already exists.';
  return null;
}

export function useSubjectActions() {
  const queryClient = useQueryClient();
  const { data: registry = [] } = useSubjectRegistry();
  const { data: allTopics } = useAllTopics();
  const topics = allTopics?.topics ?? [];

  const persistRegistry = (next: string[]) => {
    saveRegistry(next);
    queryClient.setQueryData(registryKey, next);
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      persistRegistry([...registry, trimmed]);
      return trimmed;
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const trimmed = to.trim();
      const affected = topics.filter((topic) => topic.subject === from);

      // Rename every topic of the subject first — this is the source of truth.
      if (affected.length > 0) {
        await Promise.all(affected.map((topic) => updateTopic(topic.id, { subject: trimmed })));
      }

      if (registry.includes(from)) {
        persistRegistry(registry.map((item) => (item === from ? trimmed : item)));
      }

      queryClient.invalidateQueries({ queryKey: topicsKey });
      return trimmed;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const affected = topics.filter((topic) => topic.subject === name);

      if (affected.length > 0) {
        await Promise.all(affected.map((topic) => deleteTopic(topic.id)));
      }
      if (registry.includes(name)) {
        persistRegistry(registry.filter((item) => item !== name));
      }

      queryClient.invalidateQueries({ queryKey: topicsKey });
      return { removedTopics: affected.length };
    },
  });

  return {
    createSubject: createMutation.mutateAsync,
    renameSubject: renameMutation.mutateAsync,
    deleteSubject: deleteMutation.mutateAsync,
    isPending: createMutation.isPending || renameMutation.isPending || deleteMutation.isPending,
    error: createMutation.error ?? renameMutation.error ?? deleteMutation.error,
  };
}
