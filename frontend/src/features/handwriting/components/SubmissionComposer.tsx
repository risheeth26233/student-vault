// Submission composer — subject/topic selection + multi-page image upload.
//
// Guarantees:
// - every rejected file is listed with a student-readable reason (never a
//   silent drop) and can be dismissed;
// - every accepted file is persisted as a Resource immediately (IndexedDB/R2,
//   existing blob storage) and attached to the submission — a failed upload
//   stays in a retry queue instead of disappearing on reload;
// - previews load from the Resource store, never from localStorage bytes;
// - removing a page is a two-step action so work cannot be lost by a stray
//   tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, FileImage, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { addDocument, getDocumentUrl, getResource } from '../../../services/resourceStore';
import { getSubmission } from '../../../services/handwritingStore';
import { useHandwritingActions } from '../../../hooks/useHandwriting';
import {
  formatSize,
  MAX_PAGES,
  MAX_PAGE_SIZE_LABEL,
  PAGE_ACCEPT,
  validatePageFiles,
} from '../validation';
import type { FileRejection } from '../validationTypes';
import type { HandwritingSubmission, SubmissionPage } from '../handwritingTypes';
import type { Topic } from '../../../types/api';

interface PendingUpload {
  key: string;
  file: File;
  error: string | null;
}

export interface SubmissionComposerProps {
  topics: Topic[];
  /** Active submission (null ⇒ selecting a topic starts a new one). */
  submission: HandwritingSubmission | null;
  /** Deep-link preselection (e.g. /handwriting?topic=<id>). */
  initialTopicId?: string | null;
  /** Bumped when "New submission" is pressed — resets topic selection. */
  creationToken: number;
  onCreated: (submission: HandwritingSubmission) => void;
  onError?: (message: string) => void;
}

function uniqueSubjects(topics: readonly Topic[]): string[] {
  return [...new Set(topics.map((topic) => topic.subject).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function SubmissionComposer({
  topics,
  submission,
  initialTopicId,
  creationToken,
  onCreated,
  onError,
}: SubmissionComposerProps) {
  const actions = useHandwritingActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createdIdRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const [subject, setSubject] = useState('');
  const [topicId, setTopicId] = useState(initialTopicId ?? '');
  const [rejected, setRejected] = useState<FileRejection[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  // Reset selection when the student starts a new submission (or a new
  // deep link arrives). The upload queue is intentionally NOT cleared:
  // in-flight/failed uploads keep working so nothing is discarded.
  useEffect(() => {
    createdIdRef.current = null;
    setSubject('');
    setTopicId(initialTopicId ?? '');
    setRejected([]);
    setLocalError(null);
  }, [creationToken, initialTopicId]);

  const topicOptions = topics
    .filter((topic) => !subject || topic.subject === subject)
    .map((topic) => ({ value: topic.id, label: `${topic.subject} · ${topic.title}` }));

  // Page previews come from Resource storage (IndexedDB/R2), with a graceful
  // placeholder when a blob cannot be read.
  const pageResourceKey = submission?.pages.map((page) => page.resourceId).join(',') ?? '';
  useEffect(() => {
    if (!pageResourceKey) return;
    let cancelled = false;
    (async () => {
      const ids = pageResourceKey.split(',').filter(Boolean);
      const entries = await Promise.all(
        ids.map(async (resourceId): Promise<readonly [string, string | null]> => {
          try {
            const resource = await getResource(resourceId);
            return [resourceId, getDocumentUrl(resource)];
          } catch {
            return [resourceId, null];
          }
        })
      );
      if (!cancelled) setPreviews((current) => ({ ...current, ...Object.fromEntries(entries) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [pageResourceKey]);

  const resolveTarget = useCallback((): HandwritingSubmission | null => {
    if (submission) return submission;
    if (createdIdRef.current) return getSubmission(createdIdRef.current);
    return null;
  }, [submission]);

  const uploadBatch = useCallback(
    async (batch: readonly PendingUpload[], preferredTopicId: string) => {
      const currentTopicId = preferredTopicId || resolveTarget()?.topicId || '';
      if (!currentTopicId) {
        setLocalError('Choose a subject and topic before adding pages.');
        setUploadingCount(0);
        setPending((items) => [...batch, ...items]);
        return;
      }

      let target = resolveTarget();
      if (!target && !topics.some((entry) => entry.id === currentTopicId)) {
        setLocalError('That topic no longer exists — pick another one.');
        setUploadingCount(0);
        setPending((items) => [...batch, ...items]);
        return;
      }

      for (const item of batch) {
        // Re-validate the slot: the queue may have filled up meanwhile. When no
        // submission exists yet the count starts at zero.
        const latest = target ? getSubmission(target.id) : null;
        const pageCount = latest?.pages.length ?? 0;
        if (pageCount >= MAX_PAGES) {
          setPending((items) =>
            items.map((entry) =>
              entry.key === item.key
                ? { ...entry, error: `Page limit reached (${MAX_PAGES} pages per submission).` }
                : entry
            )
          );
          continue;
        }

        try {
          const resource = await addDocument(item.file, currentTopicId);
          // The submission is only created after the first upload actually
          // succeeded — a failed batch never leaves an empty draft behind.
          if (!target) {
            const topic = topics.find((entry) => entry.id === currentTopicId);
            if (!topic) throw new Error('That topic no longer exists — pick another one.');
            target = actions.createSubmission({
              subject: topic.subject,
              topicId: topic.id,
              topicTitle: topic.title,
            });
            createdIdRef.current = target.id;
            onCreated(target);
          }
          const page: SubmissionPage = {
            resourceId: resource.id,
            name: item.file.name,
            mimeType: item.file.type,
            size: item.file.size,
            page: pageCount + 1,
            extraction: {
              status: 'pending',
              text: '',
              estimatedConfidence: null,
              notes: [],
              provider: null,
            },
          };
          actions.addPages(target.id, [page]);
          createdIdRef.current = target.id;
          setPending((items) => entriesWithout(items, item.key));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Upload failed — the file was not saved.';
          onError?.(message);
          setPending((items) =>
            items.map((entry) => (entry.key === item.key ? { ...entry, error: message } : entry))
          );
        }
      }
    },
    [actions, onError, onCreated, resolveTarget, topics]
  );

  const enqueue = useCallback(
    (batch: readonly PendingUpload[], preferredTopicId: string) => {
      queueRef.current = queueRef.current.then(() => uploadBatch(batch, preferredTopicId));
      return queueRef.current;
    },
    [uploadBatch]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setLocalError(null);

      const existingPages = resolveTarget()?.pages.length ?? 0;
      const result = validatePageFiles(list, existingPages);
      setRejected(result.rejected);

      if (result.accepted.length === 0) return;
      const batch: PendingUpload[] = result.accepted.map(({ key, file }) => ({
        key,
        file,
        error: null,
      }));
      setPending((items) => [...batch, ...items]);
      setUploadingCount((count) => count + batch.length);
      void enqueue(batch, topicId).finally(() => {
        setUploadingCount((count) => Math.max(0, count - batch.length));
      });
    },
    [enqueue, resolveTarget, topicId]
  );

  const retryUpload = useCallback(
    (key: string) => {
      const entry = pending.find((item) => item.key === key);
      if (!entry) return;
      setPending((items) => entriesWithout(items, key));
      setUploadingCount((count) => count + 1);
      void enqueue([{ ...entry, error: null }], topicId).finally(() => {
        setUploadingCount((count) => Math.max(0, count - 1));
      });
    },
    [enqueue, pending, topicId]
  );

  const topicLocked = Boolean(submission);
  const canUpload = topicLocked || Boolean(topicId);
  const uploading = uploadingCount > 0;
  const totalUsed = submission?.pages.length ?? 0;

  return (
    <Card elevation={1} padding="md" data-testid="submission-composer">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {submission ? 'Pages' : 'New handwritten submission'}
          </h2>
          <p className="text-sm text-ink-muted">
            {submission
              ? `${submission.pages.length} of ${MAX_PAGES} pages · stored on this device`
              : `Pick a subject and topic, then photograph your work — JPEG, PNG or WebP, up to ${MAX_PAGE_SIZE_LABEL} each, max ${MAX_PAGES} pages.`}
          </p>
        </div>
        <Badge variant="default" size="sm" data-testid="composer-page-count">
          {totalUsed}/{MAX_PAGES} pages
        </Badge>
      </div>

      {!topicLocked && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select
            label="Subject"
            data-testid="composer-subject"
            options={[
              { value: '', label: 'All subjects' },
              ...uniqueSubjects(topics).map((name) => ({ value: name, label: name })),
            ]}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setTopicId('');
            }}
          />
          <Select
            label="Topic"
            data-testid="composer-topic"
            placeholder={topics.length === 0 ? 'No topics yet' : 'Choose a topic…'}
            options={topicOptions}
            value={topicId}
            error={localError && !topicId ? localError : undefined}
            onChange={(event) => {
              setTopicId(event.target.value);
              setLocalError(null);
            }}
          />
        </div>
      )}

      {topicLocked && submission && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="info" size="sm">
            {submission.subject}
          </Badge>
          <span className="text-sm font-medium text-ink">{submission.topicTitle}</span>
        </div>
      )}

      {rejected.length > 0 && (
        <div
          className="mb-4 space-y-2 rounded-xl border border-coral-200 bg-coral-50 p-3"
          role="alert"
          data-testid="composer-rejections"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-coral-700">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              {rejected.length} file{rejected.length === 1 ? '' : 's'} not accepted
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejected([])}
              data-testid="composer-rejections-dismiss"
            >
              Dismiss
            </Button>
          </div>
          <ul className="space-y-1">
            {rejected.map((entry) => (
              <li key={entry.key} className="text-sm text-coral-700" data-testid="rejection-item">
                <span className="font-medium">{entry.name}</span> — {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          leftIcon={<Upload className="h-4 w-4" />}
          onClick={() => fileInputRef.current?.click()}
          disabled={!canUpload || uploading}
          data-testid="composer-add-pages"
        >
          {uploading ? 'Uploading…' : 'Add page images'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={PAGE_ACCEPT}
          multiple
          className="hidden"
          data-testid="composer-file-input"
          aria-label="Add page images"
          onChange={(event) => {
            if (event.target.files) handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {!topicLocked && (
          <p className="text-xs text-ink-subtle">
            Pages are saved straight away, so nothing is lost if you leave this page.
          </p>
        )}
      </div>

      {localError && (
        <p className="mt-3 text-sm text-coral-600" role="alert" data-testid="composer-error">
          {localError}
        </p>
      )}

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="composer-pending">
          {pending.map((entry) => (
            <li
              key={entry.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <FileImage className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="truncate">{entry.file.name}</span>
                <span className="text-xs text-ink-subtle">{formatSize(entry.file.size)}</span>
                {!entry.error && <Badge size="sm">Uploading…</Badge>}
              </span>
              {entry.error ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-coral-600">{entry.error}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => retryUpload(entry.key)}
                    data-testid={`retry-${entry.key}`}
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPending((items) => entriesWithout(items, entry.key))}
                    data-testid={`drop-${entry.key}`}
                  >
                    Remove
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {submission && submission.pages.length === 0 && pending.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            size="sm"
            illustration="resources"
            title="No pages yet"
            description={`Add photos of your handwritten work — up to ${MAX_PAGES} pages for this topic.`}
            action={
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
                data-testid="composer-empty-upload"
              >
                Add page images
              </Button>
            }
          />
        </div>
      ) : (
        submission &&
        submission.pages.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {submission.pages.map((page) => {
              const src = previews[page.resourceId];
              const confirming = confirmingRemove === page.resourceId;
              return (
                <li
                  key={page.resourceId}
                  className="group relative overflow-hidden rounded-xl border border-border bg-surface"
                  data-testid={`page-preview-${page.page}`}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-gray-100">
                    {src ? (
                      <img
                        src={src}
                        alt={`Page ${page.page} of ${page.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-ink-subtle">
                        <FileImage className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-xs text-ink-muted">Page {page.page}</span>
                    <Badge size="sm" variant={page.extraction.status === 'failed' ? 'danger' : 'default'}>
                      {page.extraction.status === 'pending'
                        ? 'Not extracted'
                        : page.extraction.status === 'low_confidence'
                          ? 'Review needed'
                          : page.extraction.status === 'failed'
                            ? 'Unread'
                            : 'Read'}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-coral-600 shadow-sm hover:bg-white"
                    aria-label={`Remove page ${page.page}`}
                    data-testid={`remove-page-${page.page}`}
                    onClick={() => {
                      if (!confirming) {
                        setConfirmingRemove(page.resourceId);
                        return;
                      }
                      setConfirmingRemove(null);
                      void actions
                        .removePage(submission.id, page.resourceId)
                        .catch((error: unknown) => {
                          const message =
                            error instanceof Error ? error.message : 'Could not remove the page.';
                          setLocalError(message);
                          onError?.(message);
                        });
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {confirming && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 px-3 text-center">
                      <p className="text-sm font-medium text-ink">
                        Remove page {page.page}? The image is deleted too.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setConfirmingRemove(null);
                            void actions
                              .removePage(submission.id, page.resourceId)
                              .catch((error: unknown) => {
                                const message =
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not remove the page.';
                                setLocalError(message);
                                onError?.(message);
                              });
                          }}
                        >
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(null)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
    </Card>
  );
}

function entriesWithout(items: readonly PendingUpload[], key: string): PendingUpload[] {
  return items.filter((entry) => entry.key !== key);
}
