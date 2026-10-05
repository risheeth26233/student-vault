// Attendance Page — subjects, marks, goals and overall attendance stats

import { useState, type FormEvent, type FocusEvent } from 'react';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState, featureEmptyStates } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToastHelpers } from '../components/ui/Toast';
import { ConfirmDialog } from '../features/vault/ConfirmDialog';
import {
  useAttendanceSubjects,
  useAttendanceStats,
  useCreateAttendanceSubject,
  useAddAttendanceRecord,
  useUndoAttendanceRecord,
  useUpdateAttendanceTarget,
  useDeleteAttendanceSubject,
  calculateSubjectStats,
  attendanceKey,
  getAttendanceMode,
  resetAttendanceMode,
} from '../hooks/useAttendance';
import { validGoal } from '../services/storage';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { AttendanceSubject } from '../types/api';

const DEFAULT_GOAL = '75';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card elevation={1} padding="md">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </Card>
  );
}

function SubjectCardSkeleton() {
  return (
    <Card elevation={1} padding="md">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </Card>
  );
}

function SubjectCard({ subject, onRemove }: { subject: AttendanceSubject; onRemove: (subject: AttendanceSubject) => void }) {
  const toast = useToastHelpers();
  const addRecord = useAddAttendanceRecord();
  const undoRecord = useUndoAttendanceRecord();
  const updateTarget = useUpdateAttendanceTarget();

  const { present, absent, total, percentage, neededForTarget } = calculateSubjectStats(subject);
  const percentValue = total > 0 ? Math.round((present * 100) / total) : 0;
  const meetsTarget = total > 0 && percentValue >= subject.target;
  const belowTarget = total > 0 && percentValue < subject.target;
  const atRecordLimit = total >= 100;

  const mark = async (record: 'present' | 'absent') => {
    try {
      await addRecord.mutateAsync({ id: subject.id, record });
    } catch (error) {
      toast.error(
        record === 'present' ? 'Could not mark present' : 'Could not mark absent',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleUndo = async () => {
    try {
      await undoRecord.mutateAsync(subject.id);
    } catch (error) {
      toast.error('Could not undo last mark', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleGoalBlur = async (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!validGoal(value)) {
      event.target.value = String(subject.target);
      return;
    }
    if (value === subject.target) return;
    try {
      await updateTarget.mutateAsync({ id: subject.id, target: value });
    } catch (error) {
      event.target.value = String(subject.target);
      toast.error('Could not update goal', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <Card elevation={1} padding="md" data-testid="attendance-card" data-subject-name={subject.name}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="truncate font-semibold text-ink" title={subject.name}>
          {subject.name}
        </h3>
        <Badge variant={meetsTarget ? 'success' : belowTarget ? 'danger' : 'default'}>
          {total > 0 ? percentage : '--'}
        </Badge>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
        <div>
          <span className="block text-lg font-bold text-ink">{present}</span>
          <small className="text-xs text-ink-muted">Present</small>
        </div>
        <div>
          <span className="block text-lg font-bold text-ink">{absent}</span>
          <small className="text-xs text-ink-muted">Absent</small>
        </div>
        <div>
          <span className="block text-lg font-bold text-ink">{total}</span>
          <small className="text-xs text-ink-muted">Total</small>
        </div>
      </div>

      {belowTarget && Number.isFinite(neededForTarget) && neededForTarget > 0 && (
        <p className="mb-3 text-xs text-ink-muted">
          {neededForTarget} more {neededForTarget === 1 ? 'class' : 'classes'} present to reach{' '}
          {subject.target}%
        </p>
      )}

      <div className="mb-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={atRecordLimit || addRecord.isPending}
          onClick={() => mark('present')}
        >
          Mark Present
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={atRecordLimit || addRecord.isPending}
          onClick={() => mark('absent')}
        >
          Mark Absent
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
          Goal
          <Input
            type="number"
            min={1}
            max={100}
            defaultValue={subject.target}
            aria-label={`Goal for ${subject.name}`}
            onBlur={handleGoalBlur}
            className="h-8 w-16 px-1 text-center"
          />
          %
        </label>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={total === 0 || undoRecord.isPending}
            onClick={handleUndo}
          >
            Undo
          </Button>
          <Button variant="ghost" size="sm" className="text-coral-600" onClick={() => onRemove(subject)}>
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AttendancePage() {
  const toast = useToastHelpers();
  const queryClient = useQueryClient();

  const listQuery = useAttendanceSubjects();
  const statsQuery = useAttendanceStats();
  const createMutation = useCreateAttendanceSubject();
  const deleteMutation = useDeleteAttendanceSubject();

  const [nameInput, setNameInput] = useState('');
  const [goalInput, setGoalInput] = useState(DEFAULT_GOAL);
  const [filterInput, setFilterInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttendanceSubject | null>(null);

  const localMode = getAttendanceMode() === 'local';
  const subjects = listQuery.data?.subjects ?? [];
  const stats = statsQuery.data;
  const filter = filterInput.trim().toLowerCase();
  const filteredSubjects = filter
    ? subjects.filter((subject) => subject.name.toLowerCase().includes(filter))
    : subjects;

  const handleAddSubject = async (event: FormEvent) => {
    event.preventDefault();
    const name = nameInput.trim();
    if (!name) {
      toast.error('Enter a subject name.');
      return;
    }
    const target = Number(goalInput);
    if (!validGoal(target)) {
      toast.error('The goal must be a whole number from 1 to 100.');
      return;
    }
    if (subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That subject is already in your list.');
      return;
    }
    try {
      await createMutation.mutateAsync({ name, target });
      toast.success('Subject added', name);
      setNameInput('');
      setGoalInput(DEFAULT_GOAL);
    } catch (error) {
      toast.error('Could not add subject', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleRemove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await deleteMutation.mutateAsync(target.id);
      toast.success('Subject removed', target.name);
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Could not remove subject', error instanceof Error ? error.message : 'Unknown error');
      setDeleteTarget(null);
    }
  };

  const handleRetryConnection = () => {
    resetAttendanceMode();
    queryClient.invalidateQueries({ queryKey: attendanceKey });
  };

  const renderSubjectList = () => {
    if (listQuery.isPending) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SubjectCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card elevation={1} padding="lg" className="text-center">
          <CircleAlert className="w-12 h-12 text-coral-500 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink mb-1">Could not load your attendance</h2>
          <p className="text-ink-muted mb-4 text-sm">{listQuery.error.message}</p>
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => listQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      );
    }

    if (subjects.length === 0) {
      return <EmptyState {...featureEmptyStates.attendance} />;
    }

    if (filteredSubjects.length === 0) {
      return (
        <EmptyState
          illustration="attendance"
          title="No subjects match your filter"
          description="Try a different search term."
          action={
            <Button variant="outline" onClick={() => setFilterInput('')} leftIcon={<X className="w-4 h-4" />}>
              Clear filter
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSubjects.map((subject) => (
          <SubjectCard key={subject.id} subject={subject} onRemove={setDeleteTarget} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Attendance</h1>
            <p className="text-ink-muted">
              {listQuery.data
                ? `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} tracked • Overall attendance ${
                    stats?.overallPercentage ?? '--'
                  }`
                : 'Track class attendance and stay on target'}
            </p>
          </div>
        </header>

        {localMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              <strong>Working offline.</strong> The server is unreachable, so your changes are being
              saved on this device.
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRetryConnection}
            >
              Retry connection
            </Button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Overall attendance" value={stats?.overallPercentage ?? '--'} />
          <StatCard label="Present" value={stats?.totalPresent ?? 0} />
          <StatCard label="Absent" value={stats?.totalAbsent ?? 0} />
          <StatCard label="Total classes" value={stats?.totalClasses ?? 0} />
        </div>

        <Section className="mb-6">
          <Card elevation={1} padding="md">
            <form onSubmit={handleAddSubject} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="attendance-subject-name" className="mb-1 block text-sm font-medium text-ink">
                  Subject name
                </label>
                <Input
                  id="attendance-subject-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="e.g. Mathematics"
                  maxLength={40}
                  aria-label="Subject name"
                />
              </div>
              <div className="sm:w-32">
                <label htmlFor="attendance-goal-input" className="mb-1 block text-sm font-medium text-ink">
                  Goal %
                </label>
                <Input
                  id="attendance-goal-input"
                  type="number"
                  min={1}
                  max={100}
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  aria-label="New subject goal percentage"
                />
              </div>
              <Button type="submit" leftIcon={<Plus className="w-4 h-4" />} loading={createMutation.isPending}>
                Add subject
              </Button>
            </form>
          </Card>
        </Section>

        <Section>
          {subjects.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />
                <Input
                  value={filterInput}
                  onChange={(event) => setFilterInput(event.target.value)}
                  placeholder="Filter subjects"
                  aria-label="Filter subjects"
                  className="pl-9"
                />
              </div>
              <p className="text-sm text-ink-muted">
                {filteredSubjects.length} of {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
              </p>
            </div>
          )}

          {renderSubjectList()}
        </Section>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={deleteTarget ? `Remove ${deleteTarget.name}?` : ''}
          description="The subject and its attendance records will be removed. This cannot be undone."
          confirmLabel="Remove subject"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={handleRemove}
        />
      </ContentWrapper>
    </PageContainer>
  );
}
