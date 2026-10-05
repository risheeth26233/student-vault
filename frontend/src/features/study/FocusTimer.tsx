// Pomodoro focus timer — start / pause / resume / reset with focus and break
// intervals. The state lives in the Study Mode session store, so the timer
// keeps running across page navigation and reloads (absolute deadline).

import { Pause, Play, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import {
  BREAK_MINUTE_OPTIONS,
  FOCUS_MINUTE_OPTIONS,
  type StudySessionState,
} from './useStudySession';

export interface FocusTimerProps {
  session: StudySessionState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onFocusMinutes: (minutes: number) => void;
  onBreakMinutes: (minutes: number) => void;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function FocusTimer({
  session,
  onStart,
  onPause,
  onReset,
  onFocusMinutes,
  onBreakMinutes,
}: FocusTimerProps) {
  const isFocus = session.mode === 'focus';
  const total = (isFocus ? session.focusMinutes : session.breakMinutes) * 60;
  const elapsed = Math.max(0, total - session.remaining);
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const started = session.running || session.remaining < total;
  const label = session.running
    ? 'Pause'
    : started
      ? 'Resume'
      : 'Start';
  const icon = session.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />;

  const handlePrimary = () => {
    if (session.running) onPause();
    else onStart();
  };

  return (
    <Card elevation={1} padding="md" className="flex h-full flex-col gap-4" data-testid="study-timer">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Focus timer</h2>
          <p className="text-sm text-ink-muted">Stay on one topic at a time</p>
        </div>
        <Badge variant={isFocus ? 'success' : 'info'} size="sm" dot data-testid="timer-mode">
          {isFocus ? 'Focus' : 'Break'}
        </Badge>
      </div>

      <div className="rounded-xl bg-surface-muted px-4 py-5 text-center">
        <p
          className="font-mono text-5xl font-bold tabular-nums text-ink"
          role="timer"
          aria-label={`${isFocus ? 'Focus' : 'Break'} time remaining ${formatTime(session.remaining)}`}
          data-testid="timer-time"
        >
          {formatTime(session.remaining)}
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={`${isFocus ? 'Focus' : 'Break'} interval progress`}
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={handlePrimary}
          leftIcon={icon}
          aria-label={label}
          data-testid={session.running ? 'timer-pause' : session.remaining < total ? 'timer-resume' : 'timer-start'}
        >
          {label}
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          leftIcon={<RotateCcw className="h-4 w-4" />}
          aria-label="Reset timer"
          data-testid="timer-reset"
        >
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <Select
          label="Focus minutes"
          value={String(session.focusMinutes)}
          onChange={(event) => onFocusMinutes(Number(event.target.value))}
          options={FOCUS_MINUTE_OPTIONS.map((value) => ({ value: String(value), label: `${value} min` }))}
          disabled={session.running}
          aria-label="Focus interval length"
          data-testid="timer-focus-minutes"
        />
        <Select
          label="Break minutes"
          value={String(session.breakMinutes)}
          onChange={(event) => onBreakMinutes(Number(event.target.value))}
          options={BREAK_MINUTE_OPTIONS.map((value) => ({ value: String(value), label: `${value} min` }))}
          disabled={session.running}
          aria-label="Break interval length"
          data-testid="timer-break-minutes"
        />
      </div>

      <p className="text-xs text-ink-subtle" data-testid="timer-sessions" role="status">
        {session.completedFocusSessions} focus session{session.completedFocusSessions === 1 ? '' : 's'} completed
        {' · '}
        {session.focusMinutesTotal} min focused
      </p>
    </Card>
  );
}
