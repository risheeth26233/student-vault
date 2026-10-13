// Shared fixtures for GuruGraph foundation tests.
// Shapes mirror the Student-Vault Phase 1 models in `src/types/api.ts`.

import type {
  Assessment,
  AttendanceSubject,
  Assignment,
  Resource,
  Topic,
} from '../../types/api';
import type { GuruGraphDataSource } from '../domain/types';

/** Fixed clock used by every test so intelligence output is reproducible. */
export const AT = '2026-10-05T00:00:00.000Z';

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    userId: 'user-1',
    subject: 'Mathematics',
    title: 'Quadratic Equations',
    examDate: null,
    notes: '',
    status: 'learning',
    checklist: { understand: true, practice: false, revise: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'assessment-1',
    userId: 'user-1',
    title: 'Week 1 quiz',
    subject: 'Mathematics',
    topicId: 'topic-1',
    type: 'quiz',
    score: 5,
    maxScore: 10,
    percentage: 50,
    date: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'assignment-1',
    userId: 'user-1',
    title: 'Problem set 3',
    description: '',
    subject: 'Mathematics',
    topicId: 'topic-1',
    dueDate: '2026-03-01T00:00:00.000Z',
    status: 'completed',
    priority: 'medium',
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-25T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAttendance(overrides: Partial<AttendanceSubject> = {}): AttendanceSubject {
  return {
    id: 'attendance-1',
    userId: 'user-1',
    name: 'Physics',
    target: 75,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    records: [
      { id: 'record-1', record: 'present', createdAt: '2026-03-01T00:00:00.000Z' },
      { id: 'record-2', record: 'absent', createdAt: '2026-03-02T00:00:00.000Z' },
      { id: 'record-3', record: 'absent', createdAt: '2026-03-03T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

export function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'resource-1',
    userId: 'user-1',
    topicId: 'topic-1',
    name: 'formula-sheet.pdf',
    mimeType: 'application/pdf',
    size: '12KB',
    data: null,
    r2Key: null,
    downloadUrl: null,
    createdAt: '2026-03-05T00:00:00.000Z',
    ...overrides,
  };
}

/** A representative mix of every supported Student-Vault source. */
export function fixtureSource(): GuruGraphDataSource {
  return {
    topics: [
      makeTopic(),
      makeTopic({
        id: 'topic-2',
        subject: 'Physics',
        title: 'Kinematics',
        status: 'reviewing',
        checklist: { understand: true, practice: true, revise: false },
        updatedAt: '2026-01-10T00:00:00.000Z',
      }),
      makeTopic({
        id: 'topic-3',
        subject: 'Chemistry',
        title: 'Moles',
        checklist: undefined,
        updatedAt: '2026-01-11T00:00:00.000Z',
      }),
    ],
    assessments: [
      makeAssessment(),
      makeAssessment({ id: 'assessment-2', subject: 'Physics', topicId: 'topic-2', score: 9, maxScore: 10 }),
    ],
    assignments: [makeAssignment(), makeAssignment({ id: 'assignment-2', subject: 'Physics', status: 'pending', topicId: 'topic-2' })],
    attendanceSubjects: [makeAttendance()],
    resources: [makeResource()],
    subjectRegistry: ['History'],
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
