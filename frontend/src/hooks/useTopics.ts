import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listTopics, getTopic, createTopic, updateTopic, updateTopicChecklist, deleteTopic, resetTopicsMode, getTopicsMode } from '../services/topicStore';
import type { Topic, TopicCreate, TopicUpdate } from '../types/api';

export { getTopicsMode, resetTopicsMode };

/** Query key prefix shared by every topic query (lists and single topics). */
export const topicsKey = ['topics'] as const;

/**
 * Apply a partial update to every cached topic query without refetching.
 * Handles both list responses (`{ topics, total }`) and single topic responses.
 */
export function patchTopicCache(queryClient: QueryClient, id: string, patch: Partial<Topic>): void {
  queryClient.setQueriesData({ queryKey: topicsKey }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;

    if ('topics' in old && Array.isArray((old as { topics: Topic[] }).topics)) {
      const list = old as { topics: Topic[]; total: number };
      if (!list.topics.some((t) => t.id === id)) return old;
      return {
        ...list,
        topics: list.topics.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
      };
    }

    if ('id' in old && (old as Topic).id === id) {
      return { ...(old as Topic), ...patch, updatedAt: new Date().toISOString() };
    }

    return old;
  });
}

export function useTopics(params: {
  subject?: string;
  status?: 'learning' | 'reviewing' | 'ready';
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: [...topicsKey, params],
    queryFn: () => listTopics(params),
    staleTime: 1000 * 60 * 2,
  });
}

/** Every topic for the signed-in user (no filters) — used for subject stats. */
export function useAllTopics() {
  return useQuery({
    queryKey: [...topicsKey, 'all'],
    queryFn: () => listTopics(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useTopic(id: string) {
  return useQuery({
    queryKey: [...topicsKey, id],
    queryFn: () => getTopic(id),
    enabled: !!id,
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TopicCreate) => createTopic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: topicsKey });
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TopicUpdate }) => updateTopic(id, data),
    onSuccess: (topic, { id }) => {
      patchTopicCache(queryClient, id, topic);
      queryClient.invalidateQueries({ queryKey: topicsKey });
    },
  });
}

export function useUpdateTopicChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checklist }: { id: string; checklist: Topic['checklist'] }) =>
      updateTopicChecklist(id, checklist),
    // Optimistic: the checkbox must feel instant.
    onMutate: async ({ id, checklist }) => {
      await queryClient.cancelQueries({ queryKey: topicsKey });
      patchTopicCache(queryClient, id, { checklist });
      return { id };
    },
    onError: (_error, _variables, context) => {
      if (context?.id) queryClient.invalidateQueries({ queryKey: topicsKey });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: topicsKey });
    },
  });
}

/**
 * Debounced notes autosave.
 * Patches the cache instead of invalidating so typing never triggers refetches.
 */
export function useSaveTopicNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateTopic(id, { notes }),
    onSuccess: (topic, { id }) => {
      patchTopicCache(queryClient, id, { notes: topic.notes });
    },
  });
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: topicsKey });
    },
  });
}
