// Study Mode session state — subject/topic selection, the Pomodoro timer and
// session counters. Everything lives in localStorage: no backend dependency,
// and the timer survives navigation and reloads through an absolute deadline
// (`endsAt`) so elapsed time is never lost while the page is closed.

import { useCallback, useEffect, useState } from 'react';

export type TimerMode = 'focus' | 'break';

export interface StudySessionState {
  subject: string | null;
  topicId: string | null;
  mode: TimerMode;
  focusMinutes: number;
  breakMinutes: number;
  /** Seconds left in the current focus/break interval. */
  remaining: number;
  running: boolean;
  /** Epoch ms for the end of the running interval (null while paused/idle). */
  endsAt: number | null;
  completedFocusSessions: number;
  focusMinutesTotal: number;
}

export const FOCUS_MINUTE_OPTIONS = [25, 45, 50] as const;
export const BREAK_MINUTE_OPTIONS = [5, 10] as const;

const STORAGE_KEY = 'sv_study_session';

export const DEFAULT_SESSION: StudySessionState = {
  subject: null,
  topicId: null,
  mode: 'focus',
  focusMinutes: 25,
  breakMinutes: 5,
  remaining: 25 * 60,
  running: false,
  endsAt: null,
  completedFocusSessions: 0,
  focusMinutesTotal: 0,
};

function pickOption(value: unknown, allowed: readonly number[], fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  return allowed.includes(num) ? num : fallback;
}

function pickInt(value: unknown, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN;
  return Number.isNaN(num) || num < 0 ? fallback : num;
}

function durationFor(mode: TimerMode, focusMinutes: number, breakMinutes: number): number {
  return (mode === 'focus' ? focusMinutes : breakMinutes) * 60;
}

/** A focus interval just ended: book it, then queue the other interval. */
function completeInterval(state: StudySessionState): StudySessionState {
  if (state.mode === 'focus') {
    return {
      ...state,
      mode: 'break',
      remaining: state.breakMinutes * 60,
      running: false,
      endsAt: null,
      completedFocusSessions: state.completedFocusSessions + 1,
      focusMinutesTotal: state.focusMinutesTotal + state.focusMinutes,
    };
  }
  return {
    ...state,
    mode: 'focus',
    remaining: state.focusMinutes * 60,
    running: false,
    endsAt: null,
  };
}

function hydrate(): StudySessionState {
  let stored: Partial<StudySessionState> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') stored = parsed as Partial<StudySessionState>;
    }
  } catch {
    // Corrupted storage falls back to the defaults.
  }

  const focusMinutes = pickOption(stored.focusMinutes, FOCUS_MINUTE_OPTIONS, DEFAULT_SESSION.focusMinutes);
  const breakMinutes = pickOption(stored.breakMinutes, BREAK_MINUTE_OPTIONS, DEFAULT_SESSION.breakMinutes);
  const mode: TimerMode = stored.mode === 'break' ? 'break' : 'focus';

  let state: StudySessionState = {
    subject: typeof stored.subject === 'string' ? stored.subject : null,
    topicId: typeof stored.topicId === 'string' ? stored.topicId : null,
    mode,
    focusMinutes,
    breakMinutes,
    remaining:
      typeof stored.remaining === 'number' && Number.isFinite(stored.remaining)
        ? Math.max(0, Math.round(stored.remaining))
        : durationFor(mode, focusMinutes, breakMinutes),
    running: stored.running === true,
    endsAt: typeof stored.endsAt === 'number' && Number.isFinite(stored.endsAt) ? stored.endsAt : null,
    completedFocusSessions: pickInt(stored.completedFocusSessions, 0),
    focusMinutesTotal: pickInt(stored.focusMinutesTotal, 0),
  };

  if (state.running && state.endsAt !== null) {
    const remaining = Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
    state = { ...state, remaining };
    if (remaining === 0) {
      // The interval elapsed while the page was closed — book it now.
      state = { ...completeInterval(state), running: false, endsAt: null };
    }
  } else if (state.remaining <= 0) {
    state = { ...state, remaining: durationFor(state.mode, focusMinutes, breakMinutes), running: false, endsAt: null };
  }

  return state;
}

export function useStudySession() {
  const [session, setSession] = useState<StudySessionState>(hydrate);

  // Persist on every change — the object is tiny, so a write per displayed
  // second is cheap and keeps reload behaviour exact.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage may be full or blocked; the session simply stays in memory.
    }
  }, [session]);

  // Tick while running, using the absolute deadline so drift cannot accumulate.
  useEffect(() => {
    if (!session.running || session.endsAt === null) return;
    const interval = window.setInterval(() => {
      setSession((prev) => {
        if (!prev.running || prev.endsAt === null) return prev;
        const remaining = Math.max(0, Math.round((prev.endsAt - Date.now()) / 1000));
        if (remaining === prev.remaining) return prev;
        if (remaining === 0) return completeInterval(prev);
        return { ...prev, remaining };
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [session.running, session.endsAt]);

  const start = useCallback(() => {
    setSession((prev) => {
      if (prev.running) return prev;
      const remaining = prev.remaining > 0 ? prev.remaining : durationFor(prev.mode, prev.focusMinutes, prev.breakMinutes);
      return { ...prev, running: true, remaining, endsAt: Date.now() + remaining * 1000 };
    });
  }, []);

  const pause = useCallback(() => {
    setSession((prev) => {
      if (!prev.running) return prev;
      const remaining =
        prev.endsAt !== null ? Math.max(0, Math.round((prev.endsAt - Date.now()) / 1000)) : prev.remaining;
      return { ...prev, running: false, endsAt: null, remaining };
    });
  }, []);

  const reset = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      running: false,
      endsAt: null,
      remaining: durationFor(prev.mode, prev.focusMinutes, prev.breakMinutes),
    }));
  }, []);

  const setFocusMinutes = useCallback((minutes: number) => {
    setSession((prev) => ({
      ...prev,
      focusMinutes: minutes,
      ...(prev.mode === 'focus' && !prev.running ? { remaining: minutes * 60 } : {}),
    }));
  }, []);

  const setBreakMinutes = useCallback((minutes: number) => {
    setSession((prev) => ({
      ...prev,
      breakMinutes: minutes,
      ...(prev.mode === 'break' && !prev.running ? { remaining: minutes * 60 } : {}),
    }));
  }, []);

  const selectSubject = useCallback((subject: string | null) => {
    setSession((prev) => ({ ...prev, subject, topicId: null }));
  }, []);

  const selectTopic = useCallback((subject: string | null, topicId: string | null) => {
    setSession((prev) => ({ ...prev, subject, topicId }));
  }, []);

  return {
    session,
    start,
    pause,
    reset,
    setFocusMinutes,
    setBreakMinutes,
    selectSubject,
    selectTopic,
  };
}
