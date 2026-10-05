import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from '../services/assessmentStore';
import type { Assessment, AssessmentCreate, AssessmentUpdate } from '../types/api';

export const assessmentsKey = ['assessments'] as const;

export { getAssessmentsMode, resetAssessmentsMode } from '../services/assessmentStore';

export function useAssessments() {
  return useQuery({
    queryKey: assessmentsKey,
    queryFn: () => listAssessments(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAssessment(id: string) {
  return useQuery({
    queryKey: ['assessments', id],
    queryFn: () => getAssessment(id),
    enabled: !!id,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentCreate) => createAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentsKey });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssessmentUpdate }) => updateAssessment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: assessmentsKey });
      queryClient.invalidateQueries({ queryKey: ['assessments', id] });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssessment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentsKey });
    },
  });
}

/** Newest first — shared by the page and the dashboard widget. */
export function sortAssessmentsByDate(
  assessments: Assessment[],
  direction: 'asc' | 'desc' = 'desc'
): Assessment[] {
  return [...assessments].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return direction === 'asc' ? diff : -diff;
    const created = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return direction === 'asc' ? -created : created;
  });
}
