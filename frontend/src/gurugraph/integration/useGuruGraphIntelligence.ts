// GuruGraph — read-only integration with existing Student-Vault data.
//
// This hook is the ONLY connection between the workspace and the intelligence
// layer: it subscribes to the same queries the Phase 1 pages already use and
// feeds them into the GuruGraph service. It never writes back to a
// Student-Vault store, so Phase 1 behaviour is untouched.

import { useMemo, useState } from 'react';
import { useAllTopics } from '../../hooks/useTopics';
import { useAssessments } from '../../hooks/useAssessments';
import { useAssignments } from '../../hooks/useAssignments';
import { useAttendanceSubjects } from '../../hooks/useAttendance';
import { useResources } from '../../hooks/useResources';
import { useSubjectRegistry } from '../../hooks/useSubjects';
import { createGuruGraphService } from '../service/intelligenceService';
import type { GuruGraphIntelligenceService, IngestReport, IntelligenceSnapshot } from '../domain/types';

export interface GuruGraphDataSummary {
  topics: number;
  assessments: number;
  assignments: number;
  attendanceSubjects: number;
  resources: number;
  subjects: number;
}

export interface GuruGraphIntelligenceResult {
  snapshot: IntelligenceSnapshot | null;
  report: IngestReport | null;
  summary: GuruGraphDataSummary;
  /** True while any source query has not resolved yet. */
  isLoading: boolean;
  /** True once intelligence has been computed from resolved data. */
  isReady: boolean;
  error: unknown;
  service: GuruGraphIntelligenceService;
}

export interface UseGuruGraphIntelligenceOptions {
  enabled?: boolean;
}

export function useGuruGraphIntelligence(
  options: UseGuruGraphIntelligenceOptions = {}
): GuruGraphIntelligenceResult {
  const { enabled = true } = options;

  const topicsQuery = useAllTopics();
  const assessmentsQuery = useAssessments();
  const assignmentsQuery = useAssignments();
  const attendanceQuery = useAttendanceSubjects();
  const resourcesQuery = useResources();
  const subjectsQuery = useSubjectRegistry();

  // One stable service instance per mounted hook (lazy state initializer).
  const [service] = useState<GuruGraphIntelligenceService>(() => createGuruGraphService());

  const topics = topicsQuery.data?.topics;
  const assessments = assessmentsQuery.data?.assessments;
  const assignments = assignmentsQuery.data?.assignments;
  const attendanceSubjects = attendanceQuery.data?.subjects;
  const resources = resourcesQuery.data?.resources;
  const subjectRegistry = subjectsQuery.data;

  const isLoading =
    topicsQuery.isPending ||
    assessmentsQuery.isPending ||
    assignmentsQuery.isPending ||
    attendanceQuery.isPending ||
    resourcesQuery.isPending ||
    subjectsQuery.isPending;

  const error =
    topicsQuery.error ??
    assessmentsQuery.error ??
    assignmentsQuery.error ??
    attendanceQuery.error ??
    resourcesQuery.error ??
    subjectsQuery.error ??
    null;

  const snapshot = useMemo(() => {
    if (!enabled || isLoading) return service.getSnapshot();
    service.ingest({
      topics,
      assessments,
      assignments,
      attendanceSubjects,
      resources,
      subjectRegistry,
    });
    return service.compute();
  }, [
    service,
    enabled,
    isLoading,
    topics,
    assessments,
    assignments,
    attendanceSubjects,
    resources,
    subjectRegistry,
  ]);

  const report = snapshot?.report ?? null;
  const summary: GuruGraphDataSummary = {
    topics: report?.accepted.topics ?? 0,
    assessments: report?.accepted.assessments ?? 0,
    assignments: report?.accepted.assignments ?? 0,
    attendanceSubjects: report?.accepted.attendance ?? 0,
    resources: report?.accepted.resources ?? 0,
    subjects: report?.accepted.subjects ?? 0,
  };

  return {
    snapshot,
    report,
    summary,
    isLoading,
    isReady: Boolean(snapshot),
    error,
    service,
  };
}
