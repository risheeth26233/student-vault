// Note card — a study topic surfaced through its notes field.
// Notes reuse the existing Topic model (`topic.notes`), so a note always stays
// linked to a subject and a Vault topic.

import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import type { Topic } from '../../types/api';

export interface NoteCardProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  onSelectSubject: (subject: string) => void;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function NoteCard({ topic, onEdit, onDelete, onSelectSubject }: NoteCardProps) {
  const navigate = useNavigate();
  const hasNotes = topic.notes.trim().length > 0;

  return (
    <Card
      elevation={1}
      padding="md"
      className="flex h-full flex-col gap-3"
      data-testid="note-card"
      data-note-id={topic.id}
      data-note-title={topic.title}
      data-note-subject={topic.subject}
      data-note-has-notes={hasNotes ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectSubject(topic.subject)}
          className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100"
          aria-label={`Filter notes by subject ${topic.subject}`}
          data-testid="note-subject"
        >
          {topic.subject}
        </button>
        <span className="text-xs text-ink-subtle" data-testid="note-updated">
          {formatUpdated(topic.updatedAt)}
        </span>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold leading-snug text-ink" data-testid="note-title">
          {topic.title}
        </h3>
        {hasNotes ? (
          <p
            className="whitespace-pre-line line-clamp-4 text-sm text-ink-muted"
            data-testid="note-preview"
          >
            {topic.notes}
          </p>
        ) : (
          <p className="text-sm italic text-ink-subtle" data-testid="note-preview">
            No notes yet — edit this note to add one.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => onEdit(topic)}
          aria-label={`Edit note ${topic.title}`}
          data-testid="note-edit"
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-coral-600 hover:bg-coral-50"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => onDelete(topic)}
          aria-label={`Delete note ${topic.title}`}
          data-testid="note-delete"
        >
          Delete
        </Button>
        <button
          type="button"
          onClick={() => navigate(`/vault?topic=${encodeURIComponent(topic.id)}`)}
          className={cn(
            'ml-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-700',
            'transition-colors hover:text-teal-800 hover:underline'
          )}
          aria-label={`Open note ${topic.title} in My Vault`}
          data-testid="note-open-vault"
        >
          Open in Vault
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
