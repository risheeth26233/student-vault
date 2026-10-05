// Document card — a PDF or image resource attached to a Vault topic.
// Documents reuse the existing Resource model, so every file stays linked to a
// subject and topic through its `topicId`.

import { ArrowUpRight, Eye, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { documentKind, documentKindLabel, formatDocumentSize } from './documentUtils';
import type { Resource } from '../../types/api';

export interface DocumentCardProps {
  resource: Resource;
  topicTitle?: string;
  subject?: string;
  onOpen: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
  onSelectSubject?: (subject: string) => void;
}

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function DocumentCard({
  resource,
  topicTitle,
  subject,
  onOpen,
  onDelete,
  onSelectSubject,
}: DocumentCardProps) {
  const navigate = useNavigate();
  const kind = documentKind(resource);
  const kindLabel = documentKindLabel(resource);
  const hasContent = !!(resource.downloadUrl || resource.data);
  const sizeLabel = formatDocumentSize(resource.size);

  return (
    <Card
      elevation={1}
      padding="md"
      className="flex h-full flex-col gap-3"
      data-testid="document-card"
      data-document-id={resource.id}
      data-document-name={resource.name}
      data-document-type={kind}
      data-document-size={sizeLabel}
      data-document-topic={topicTitle ?? ''}
      data-document-subject={subject ?? ''}
    >
      <div className="flex items-start justify-between gap-3">
        {subject ? (
          <button
            type="button"
            onClick={() => onSelectSubject?.(subject)}
            className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100"
            aria-label={`Filter documents by subject ${subject}`}
            data-testid="document-subject"
          >
            {subject}
          </button>
        ) : (
          <span
            className="rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-muted"
            data-testid="document-subject"
          >
            No subject
          </span>
        )}
        <span className="text-xs text-ink-subtle" data-testid="document-added">
          {formatAdded(resource.createdAt)}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
            kind === 'pdf' ? 'bg-coral-50 text-coral-600' : 'bg-teal-50 text-teal-700'
          )}
          aria-hidden="true"
        >
          {kind === 'pdf' ? (
            <FileText className="w-5 h-5" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <h3
            className="truncate text-base font-semibold leading-snug text-ink"
            title={resource.name}
            data-testid="document-name"
          >
            {resource.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" size="sm" data-testid="document-type">
              {kindLabel}
            </Badge>
            <span className="text-xs text-ink-subtle" data-testid="document-size">
              {sizeLabel}
            </span>
          </div>
          <p className="truncate text-sm text-ink-muted" data-testid="document-topic">
            {topicTitle ? `In ${topicTitle}` : 'Topic no longer exists'}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          onClick={() => onOpen(resource)}
          disabled={!hasContent}
          aria-label={`Open document ${resource.name}`}
          data-testid="document-open"
        >
          Open
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-coral-600 hover:bg-coral-50"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => onDelete(resource)}
          aria-label={`Delete document ${resource.name}`}
          data-testid="document-delete"
        >
          Delete
        </Button>
        <button
          type="button"
          onClick={() => navigate(`/vault?topic=${encodeURIComponent(resource.topicId)}`)}
          className={cn(
            'ml-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-700',
            'transition-colors hover:text-teal-800 hover:underline'
          )}
          aria-label={`Open document ${resource.name} topic in My Vault`}
          data-testid="document-open-vault"
        >
          Open in Vault
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
