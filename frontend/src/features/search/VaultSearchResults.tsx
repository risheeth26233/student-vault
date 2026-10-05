// Grouped "My Vault" search results — subjects, topics, notes, documents,
// assignments, performance records and attendance subjects. Discovery only:
// every row deep-links to the page that owns the record.

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  NotebookPen,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import type { VaultResult, VaultResultGroup, VaultResultKind } from './searchUtils';

const KIND_ICONS: Record<VaultResultKind, React.ComponentType<{ className?: string }>> = {
  subject: BookOpen,
  topic: NotebookPen,
  note: NotebookPen,
  document: FileText,
  assignment: ClipboardList,
  performance: TrendingUp,
  attendance: Calendar,
};

function ResultRow({ result }: { result: VaultResult }) {
  const Icon = KIND_ICONS[result.kind];
  return (
    <Link
      to={result.href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:border-teal-300 hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      data-testid="search-result"
      data-result-kind={result.kind}
      data-result-title={result.title}
    >
      <span
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600"
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink group-hover:text-teal-700">
          {result.title}
        </span>
        {result.subtitle && (
          <span className="mt-0.5 block truncate text-xs text-ink-muted">{result.subtitle}</span>
        )}
        {result.snippet && (
          <span className="mt-1 block text-xs leading-relaxed text-ink-subtle">{result.snippet}</span>
        )}
      </span>
    </Link>
  );
}

export function VaultSearchResults({ groups }: { groups: VaultResultGroup[] }) {
  return (
    <div className="space-y-6" data-testid="search-vault-results">
      {groups.map((group) => (
        <section key={group.kind} aria-label={group.label} data-testid={`search-group-${group.kind}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">{group.label}</h2>
            <Badge variant="default" size="sm" data-testid={`search-group-count-${group.kind}`}>
              {group.items.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <ResultRow key={`${group.kind}-${item.id}`} result={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function VaultSearchLoading() {
  return (
    <div className="space-y-6" data-testid="search-loading">
      {[0, 1].map((row) => (
        <section key={row} className="space-y-3">
          <div className={cn('h-5 w-32 animate-pulse rounded bg-border')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="h-[76px] animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
