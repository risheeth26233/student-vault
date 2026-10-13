// Phase 1 protection: the GuruGraph foundation must consume Student-Vault data
// without ever changing it — neither the records it is handed nor the
// localStorage keys the workspace already owns.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGuruGraphService } from '../service/intelligenceService';
import {
  loadAssessments,
  loadAssignments,
  loadAttendanceSubjects,
  loadTopics,
  saveAssessments,
  saveAssignments,
  saveAttendanceSubjects,
  saveTopics,
} from '../../services/storage';
import {
  AT,
  deepFreeze,
  fixtureSource,
  makeAssessment,
  makeAttendance,
  makeAssignment,
  makeTopic,
} from './fixtures';

interface FakeStorage {
  keys(prefix?: string): string[];
  snapshot(prefix?: string): string;
  restore(): void;
}

function installFakeLocalStorage(): FakeStorage {
  const data = new Map<string, string>();
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  const api = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = api;

  return {
    keys: (prefix) => [...data.keys()].filter((key) => !prefix || key.startsWith(prefix)).sort(),
    snapshot: (prefix) =>
      JSON.stringify(
        [...data.entries()]
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      ),
    restore: () => {
      if (original === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
      else (globalThis as { localStorage?: unknown }).localStorage = original;
    },
  };
}

let storage: FakeStorage;

beforeAll(() => {
  storage = installFakeLocalStorage();
  saveTopics([makeTopic()]);
  saveAssignments([makeAssignment()]);
  saveAssessments([makeAssessment()]);
  saveAttendanceSubjects([makeAttendance()]);
});

afterAll(() => {
  storage.restore();
});

describe('no mutation of Phase 1 behaviour', () => {
  it('reads Phase 1 records exactly as the workspace stored them', () => {
    expect(loadTopics()).toHaveLength(1);
    expect(loadTopics()[0].id).toBe('topic-1');
    expect(loadAssignments()).toHaveLength(1);
    expect(loadAssessments()).toHaveLength(1);
    expect(loadAttendanceSubjects()).toHaveLength(1);
  });

  it('leaves Phase 1 records untouched when handed frozen data', () => {
    const source = deepFreeze(fixtureSource());
    const before = JSON.parse(JSON.stringify(source)) as unknown;

    const service = createGuruGraphService({ now: () => AT, storage: createInMemoryOnlyStorage() });
    service.ingest(source);
    service.compute();

    // Frozen objects throw in strict mode if anything writes to them, and the
    // deep comparison also proves no field was rewritten.
    expect(JSON.parse(JSON.stringify(source))).toEqual(before);
  });

  it('never writes to Student-Vault localStorage keys', () => {
    const phase1Before = storage.snapshot('sv_');
    const topicsBefore = JSON.stringify(loadTopics());

    const service = createGuruGraphService({ now: () => AT });
    service.ingest({
      topics: loadTopics(),
      assessments: loadAssessments(),
      assignments: loadAssignments(),
      attendanceSubjects: loadAttendanceSubjects(),
    });
    service.compute();

    expect(storage.snapshot('sv_')).toBe(phase1Before);
    expect(JSON.stringify(loadTopics())).toBe(topicsBefore);
    expect(storage.keys('gurugraph.')).toContain('gurugraph.intelligence.v1');
    expect(storage.keys('sv_').every((key) => key.startsWith('sv_'))).toBe(true);
  });

  it('stays fully functional with an empty workspace', () => {
    const service = createGuruGraphService({ now: () => AT, storage: createInMemoryOnlyStorage() });
    service.ingest({ topics: [], assessments: [], assignments: [], attendanceSubjects: [] });
    const snapshot = service.compute();

    expect(snapshot.topics).toEqual([]);
    expect(snapshot.mastery).toEqual([]);
    expect(snapshot.gaps).toEqual([]);
    expect(snapshot.signals).toEqual([]);
    expect(snapshot.report.accepted).toEqual({
      topics: 0,
      assessments: 0,
      assignments: 0,
      attendance: 0,
      resources: 0,
      subjects: 0,
    });
  });
});

function createInMemoryOnlyStorage() {
  const data = new Map<string, string>();
  return {
    get: (key: string) => data.get(key) ?? null,
    set: (key: string, value: string) => {
      data.set(key, value);
    },
    remove: (key: string) => {
      data.delete(key);
    },
  };
}
