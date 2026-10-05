import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAttendance,
  getAttendance,
  getAttendanceStats,
  createAttendanceSubject,
  updateAttendanceSubject,
  addAttendanceRecord,
  undoAttendanceRecord,
  updateAttendanceTarget,
  deleteAttendanceSubject,
} from '../services/attendanceStore';
import type { AttendanceSubject, AttendanceSubjectCreate, AttendanceSubjectUpdate } from '../types/api';

export const attendanceKey = ['attendance'] as const;

export { getAttendanceMode, resetAttendanceMode } from '../services/attendanceStore';

export function useAttendanceSubjects() {
  return useQuery({
    queryKey: attendanceKey,
    queryFn: () => listAttendance(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAttendanceStats() {
  return useQuery({
    queryKey: ['attendance', 'stats'],
    queryFn: () => getAttendanceStats(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAttendanceSubject(id: string) {
  return useQuery({
    queryKey: ['attendance', id],
    queryFn: () => getAttendance(id),
    enabled: !!id,
  });
}

export function useCreateAttendanceSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AttendanceSubjectCreate) => createAttendanceSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
    },
  });
}

export function useUpdateAttendanceSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AttendanceSubjectUpdate }) =>
      updateAttendanceSubject(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
    },
  });
}

export function useAddAttendanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, record }: { id: string; record: 'present' | 'absent' }) =>
      addAttendanceRecord(id, record),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
    },
  });
}

export function useUndoAttendanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => undoAttendanceRecord(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
    },
  });
}

export function useUpdateAttendanceTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, target }: { id: string; target: number }) =>
      updateAttendanceTarget(id, target),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
    },
  });
}

export function useDeleteAttendanceSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttendanceSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKey });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
    },
  });
}

export function calculateSubjectStats(subject: AttendanceSubject) {
  const present = subject.records.filter((r) => r.record === 'present').length;
  const absent = subject.records.filter((r) => r.record === 'absent').length;
  const total = subject.records.length;
  const percentage = total === 0 ? '--' : `${((present * 100) / total).toFixed(1)}%`;
  const neededForTarget = calculateClassesNeeded(present, absent, subject.target);
  return { present, absent, total, percentage, neededForTarget };
}

export function calculateClassesNeeded(present: number, absent: number, target: number): number {
  if (target >= 100) return Infinity;
  const currentTotal = present + absent;
  if (currentTotal === 0) return 0;
  const currentPercentage = (present * 100) / currentTotal;
  if (currentPercentage >= target) return 0;
  // Formula: (present + x) / (currentTotal + x) >= target / 100
  // x = (target * currentTotal - 100 * present) / (100 - target)
  const needed = Math.ceil((target * currentTotal - 100 * present) / (100 - target));
  return Math.max(0, needed);
}
