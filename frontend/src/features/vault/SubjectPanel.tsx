// Subject panel — list, filter, create, rename and delete subjects.
// Subjects are derived from topics plus a small local registry (see useSubjects).

import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToastHelpers } from '../../components/ui/Toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../components/ui/DropdownMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { useSubjects, useSubjectActions, validateSubjectName, SUBJECT_MAX_LENGTH } from '../../hooks/useSubjects';
import { cn } from '../../lib/utils';
import { Plus, Layers, Pencil, Trash, EllipsisVertical } from 'lucide-react';

export interface SubjectPanelProps {
  selected: string | null;
  onSelect: (subject: string | null) => void;
  isLoading?: boolean;
}

export function SubjectPanel({ selected, onSelect, isLoading = false }: SubjectPanelProps) {
  const subjects = useSubjects();
  const { createSubject, renameSubject, deleteSubject, isPending } = useSubjectActions();
  const toast = useToastHelpers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'rename'>('create');
  const [renameTarget, setRenameTarget] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ name: string; topicCount: number } | null>(null);

  const totalTopics = subjects.reduce((sum, subject) => sum + subject.topicCount, 0);

  const openCreate = () => {
    setDialogMode('create');
    setRenameTarget('');
    setNameValue('');
    setFormError(null);
    setDialogOpen(true);
  };

  const openRename = (subjectName: string) => {
    setDialogMode('rename');
    setRenameTarget(subjectName);
    setNameValue(subjectName);
    setFormError(null);
    setDialogOpen(true);
  };

  const submitDialog = async (event: React.FormEvent) => {
    event.preventDefault();
    const existing = subjects.map((subject) => subject.name);
    const validation = validateSubjectName(nameValue, existing, {
      exclude: dialogMode === 'rename' ? renameTarget : undefined,
    });
    if (validation) {
      setFormError(validation);
      return;
    }

    const trimmed = nameValue.trim();
    try {
      if (dialogMode === 'create') {
        await createSubject(trimmed);
        toast.success('Subject created', `You can now add topics to ${trimmed}.`);
        onSelect(trimmed);
      } else {
        await renameSubject({ from: renameTarget, to: trimmed });
        toast.success('Subject renamed', `${renameTarget} is now ${trimmed}.`);
        if (selected === renameTarget) onSelect(trimmed);
      }
      setDialogOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the subject.');
    }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    const { name, topicCount } = confirmTarget;
    try {
      await deleteSubject(name);
      toast.success('Subject deleted', topicCount > 0 ? `${name} and its topics were removed.` : `${name} was removed.`);
      if (selected === name) onSelect(null);
      setConfirmTarget(null);
    } catch (error) {
      toast.error('Could not delete subject', error instanceof Error ? error.message : 'Unknown error');
      setConfirmTarget(null);
    }
  };

  return (
    <>
      <Card elevation={1} padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Subjects</h2>
            <p className="text-xs text-ink-muted">
              {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} · {totalTopics}{' '}
              {totalTopics === 1 ? 'topic' : 'topics'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton variant="rectangular" height="2.25rem" />
            <Skeleton variant="rectangular" height="2.25rem" />
            <Skeleton variant="rectangular" height="2.25rem" />
          </div>
        ) : subjects.length === 0 ? (
          <EmptyState
            size="sm"
            title="No subjects yet"
            description="Create a subject, then add topics to it."
            illustration="topics"
          />
        ) : (
          <ul className="space-y-1.5">
            <li>
              <button
                type="button"
                onClick={() => onSelect(null)}
                aria-current={selected === null ? 'true' : undefined}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  selected === null
                    ? 'bg-teal-600 text-white'
                    : 'bg-canvas text-ink hover:bg-teal-50 hover:text-teal-700'
                )}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Layers className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  All subjects
                </span>
                <span className={cn('text-xs font-semibold', selected === null ? 'text-teal-100' : 'text-ink-muted')}>
                  {totalTopics}
                </span>
              </button>
            </li>

            {subjects.map((subject) => (
              <li key={subject.name}>
                <div
                  className={cn(
                    'group flex items-center gap-1 rounded-lg transition-colors',
                    selected === subject.name ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-canvas'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(subject.name)}
                    aria-current={selected === subject.name ? 'true' : undefined}
                    className={cn(
                      'flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                      selected === subject.name ? 'text-teal-800 font-semibold' : 'text-ink hover:text-teal-700'
                    )}
                  >
                    <span className="truncate">{subject.name}</span>
                    <Badge variant={subject.topicCount > 0 ? 'success' : 'default'} size="sm">
                      {subject.topicCount}
                    </Badge>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${subject.name}`}
                        className="p-1.5 mr-1 rounded-md text-ink-muted opacity-60 group-hover:opacity-100 hover:bg-gray-100 hover:text-ink transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <EllipsisVertical className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openRename(subject.name)}>
                        <Pencil className="w-4 h-4 mr-2" aria-hidden="true" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setConfirmTarget({ name: subject.name, topicCount: subject.topicCount })}
                        className="text-coral-600 focus:text-coral-700"
                      >
                        <Trash className="w-4 h-4 mr-2" aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Create / rename dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'New subject' : 'Rename subject'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Subjects group your study topics.'
                : 'Every topic in this subject will be moved to the new name.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitDialog} className="space-y-4" noValidate>
            <Input
              label="Subject name"
              value={nameValue}
              onChange={(event) => {
                setNameValue(event.target.value);
                setFormError(null);
              }}
              error={formError ?? undefined}
              maxLength={SUBJECT_MAX_LENGTH}
              placeholder="e.g. Physics"
              autoComplete="off"
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending}>
                {dialogMode === 'create' ? 'Create subject' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget ? `Delete ${confirmTarget.name}?` : ''}
        description={
          confirmTarget && confirmTarget.topicCount > 0
            ? `This will also delete ${confirmTarget.topicCount} ${
                confirmTarget.topicCount === 1 ? 'topic' : 'topics'
              } and their attached resources. This cannot be undone.`
            : confirmTarget
              ? 'This subject has no topics and will simply be removed.'
              : undefined
        }
        confirmLabel="Delete subject"
        destructive
        loading={isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
