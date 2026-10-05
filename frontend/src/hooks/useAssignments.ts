import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../services/assignmentStore';
import type { Assignment, AssignmentCreate, AssignmentUpdate } from '../types/api';

export const assignmentsKey = ['assignments'] as const;

export { getAssignmentsMode, resetAssignmentsMode } from '../services/assignmentStore';

export function useAssignments() {
  return useQuery({
    queryKey: assignmentsKey,
    queryFn: () => listAssignments(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: ['assignments', id],
    queryFn: () => getAssignment(id),
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignmentCreate) => createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignmentUpdate }) => updateAssignment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
      queryClient.invalidateQueries({ queryKey: ['assignments', id] });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    },
  });
}

/** Sort helper shared by the page and the dashboard widget. */
export function sortAssignmentsByDueDate(assignments: Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
