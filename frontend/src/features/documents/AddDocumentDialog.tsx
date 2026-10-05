// Add document dialog — pick a Vault topic, choose PDF/image files, upload.
// Files are stored through the existing Resource model (cloud → base64 →
// IndexedDB), so no second document system is introduced.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Paperclip, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { useToastHelpers } from '../../components/ui/Toast';
import { MAX_FILE_SIZE, DOCUMENT_ACCEPT } from '../../services/resourceStore';
import { formatDocumentSize } from './documentUtils';
import type { Topic } from '../../types/api';

export interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: Topic[];
  defaultTopicId?: string | null;
  isSubmitting: boolean;
  onSubmit: (files: File[], topicId: string) => Promise<void>;
}

interface RejectedFile {
  name: string;
  reason: string;
}

function describeTopic(topic: Topic): string {
  return `${topic.subject} — ${topic.title}`;
}

export function AddDocumentDialog({
  open,
  onOpenChange,
  topics,
  defaultTopicId,
  isSubmitting,
  onSubmit,
}: AddDocumentDialogProps) {
  const toast = useToastHelpers();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [topicId, setTopicId] = useState(() => defaultTopicId ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  // Guards against the file input firing `change` more than once for one selection.
  const knownFiles = useRef(new Set<string>());
  const knownRejected = useRef(new Set<string>());

  // Re-seed the form each time the dialog opens (fresh topic preselect, no stale files).
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setRejected([]);
    setTopicId(defaultTopicId ?? '');
    knownFiles.current.clear();
    knownRejected.current.clear();
    if (inputRef.current) inputRef.current.value = '';
  }, [open, defaultTopicId]);

  const topicOptions = topics.map((topic) => ({
    value: topic.id,
    label: describeTopic(topic),
  }));

  const reset = () => {
    setFiles([]);
    setRejected([]);
    setTopicId(defaultTopicId ?? '');
    knownFiles.current.clear();
    knownRejected.current.clear();
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) reset();
    onOpenChange(nextOpen);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;

    const accepted: File[] = [];
    const rejectedNow: RejectedFile[] = [];

    for (const file of Array.from(incoming)) {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        rejectedNow.push({ name: file.name, reason: 'Only PDF and image files are allowed' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejectedNow.push({ name: file.name, reason: 'File is larger than 20 MB' });
        continue;
      }
      accepted.push(file);
    }

    const newRejected = rejectedNow.filter((entry) => {
      const key = `${entry.name}:${entry.reason}`;
      if (knownRejected.current.has(key)) return false;
      knownRejected.current.add(key);
      return true;
    });

    if (newRejected.length > 0) {
      setRejected((current) => [...current, ...newRejected]);
      toast.warning(
        `${newRejected.length} file${newRejected.length > 1 ? 's' : ''} skipped`,
        newRejected.map((entry) => entry.name).join(', ')
      );
    }

    const newFiles = accepted.filter((file) => {
      const key = `${file.name}:${file.size}`;
      if (knownFiles.current.has(key)) return false;
      knownFiles.current.add(key);
      return true;
    });

    if (newFiles.length > 0) {
      setFiles((current) => [...current, ...newFiles]);
      setRejected((current) =>
        current.filter((entry) => !newFiles.some((file) => file.name === entry.name))
      );
    }
  };

  const removeFile = (name: string) => {
    setFiles((current) => {
      const removed = current.filter((file) => file.name === name);
      for (const file of removed) knownFiles.current.delete(`${file.name}:${file.size}`);
      return current.filter((file) => file.name !== name);
    });
  };

  const canSubmit = files.length > 0 && !!topicId && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !topicId) return;
    try {
      await onSubmit(files, topicId);
    } catch (error) {
      toast.error(
        'Could not add document',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return;
    }
    reset();
    onOpenChange(false);
  };

  if (topics.length === 0) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-sm" data-testid="documents-add-dialog">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>
              Documents are attached to a study topic, so your files stay organised by subject.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-ink-muted" data-testid="documents-no-topics">
            You do not have any topics yet. Create a topic in My Vault first, then attach PDFs or
            images to it.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => { onOpenChange(false); navigate('/vault'); }} leftIcon={<Paperclip className="w-4 h-4" />}>
              Go to My Vault
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="documents-add-dialog">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            Upload a PDF or image (up to 20 MB) and attach it to one of your topics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="document-topic">
              Topic
            </label>
            <Select
              id="document-topic"
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
              options={[{ value: '', label: 'Choose a topic…' }, ...topicOptions]}
              aria-label="Choose a topic for this document"
              data-testid="document-topic-select"
            />
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              multiple
              onChange={(event) => addFiles(event.target.files)}
              className="sr-only"
              aria-label="Choose files"
              data-testid="document-file-input"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              leftIcon={<FileUp className="w-4 h-4" />}
              onClick={() => inputRef.current?.click()}
              data-testid="document-choose-files"
            >
              Choose files
            </Button>
            <p className="mt-1.5 text-xs text-ink-subtle">PDF or image · 20 MB max per file</p>
          </div>

          {files.length > 0 && (
            <ul className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-2" data-testid="document-file-list">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-sm"
                  data-testid="document-file-item"
                >
                  <span className="min-w-0 truncate text-ink" title={file.name}>
                    {file.name}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-subtle">{formatDocumentSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="rounded p-1 text-ink-muted transition-colors hover:bg-coral-50 hover:text-coral-600"
                      aria-label={`Remove ${file.name}`}
                      data-testid="document-file-remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rejected.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-coral-200 bg-coral-50 p-2.5 text-xs text-coral-700" data-testid="document-rejected-list">
              {rejected.map((entry) => (
                <li key={`${entry.name}-${entry.reason}`}>
                  <span className="font-semibold">{entry.name}</span> — {entry.reason}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => close(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!canSubmit}
            onClick={handleSubmit}
            leftIcon={<FileUp className="w-4 h-4" />}
            data-testid="document-submit"
          >
            {files.length > 1 ? `Upload ${files.length} files` : 'Upload document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
