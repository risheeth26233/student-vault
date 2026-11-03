// Extraction review — automatic extraction with consent, or manual
// transcription, then student confirmation of the text used for evaluation.
//
// Honesty rules enforced here:
// - the provider state is shown truthfully (extracting / available / not
//   configured / failed) — success is never claimed before pages return text;
// - low-confidence or ambiguous pages must be explicitly reviewed before the
//   text can be confirmed;
// - the raw per-page drafts are preserved as extracted (evidence); the
//   editable combined text is the student's correction and becomes the
//   confirmed input evaluation is allowed to read;
// - when no provider is available, manual transcription is offered instead —
//   never a fake processing result.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CheckCircle2, FileText, ScanText, ShieldCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Textarea } from '../../../components/ui/Input';
import { useHandwritingActions } from '../../../hooks/useHandwriting';
import { anyExtractionText, joinDraftText, runExtraction } from '../extractionService';
import type { EvidenceQuality, HandwritingSubmission } from '../handwritingTypes';

const EXTRACT_PHASE_STATUSES: ReadonlyArray<HandwritingSubmission['status']> = [
  'draft',
  'extracting',
  'extracted',
  'provider_unavailable',
  'extraction_failed',
];

export function isExtractionPhase(status: HandwritingSubmission['status']): boolean {
  return EXTRACT_PHASE_STATUSES.includes(status);
}

function statusBanner(submission: HandwritingSubmission): {
  tone: 'info' | 'success' | 'warning' | 'danger';
  message: string;
} | null {
  switch (submission.status) {
    case 'extracting':
      return { tone: 'info', message: 'Extracting text from your pages…' };
    case 'extracted':
      return {
        tone: submission.extractionMessage ? 'warning' : 'success',
        message: submission.extractionMessage ?? 'Text extracted — review it below before evaluating.',
      };
    case 'provider_unavailable':
      return {
        tone: 'warning',
        message:
          submission.extractionMessage ??
          'Automatic extraction is unavailable — type the text in manually below. Your pages are saved.',
      };
    case 'extraction_failed':
      return {
        tone: 'danger',
        message:
          submission.extractionMessage ??
          'Extraction produced no usable text. Retry, or type the text in manually below.',
      };
    default:
      return null;
  }
}

export interface ExtractionReviewProps {
  submission: HandwritingSubmission;
  /** Server OCR status: true/false configured, null when unknown/unreachable. */
  ocrConfigured: boolean | null;
  ocrProvider: string | null;
}

export function ExtractionReview({
  submission,
  ocrConfigured,
  ocrProvider,
}: ExtractionReviewProps) {
  const actions = useHandwritingActions();
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [reviewed, setReviewed] = useState(submission.reviewedAt !== null);
  const [localError, setLocalError] = useState<string | null>(null);
  const initializedFor = useRef<string>('');

  const draftSignature = useMemo(
    () =>
      submission.pages
        .map((page) => `${page.page}:${page.extraction.status}:${page.extraction.extractedAt ?? ''}`)
        .join('|'),
    [submission.pages]
  );

  // Prefill the editable text: fresh drafts for a first pass, the student's
  // own confirmed/corrected text when returning to edit it. Keyed so blur
  // persistence never clobbers what is being typed.
  useEffect(() => {
    const key = `${submission.id}:${submission.confirmedAt ?? ''}:${draftSignature}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;

    if (submission.confirmedAt) {
      setDraftText(submission.confirmedText);
      setReviewed(submission.reviewedAt !== null);
      return;
    }
    setDraftText(anyExtractionText(submission.pages) ? joinDraftText(submission.pages) : '');
  }, [submission, draftSignature]);

  const joinedDrafts = useMemo(() => joinDraftText(submission.pages), [submission.pages]);
  // Header-only joins (`--- Page N ---` with no text) are NOT extracted drafts —
  // otherwise manual transcription would be mislabelled as a correction.
  const hasDraftText = anyExtractionText(submission.pages);
  const needsReview = submission.pages.some((page) => page.extraction.status === 'low_confidence');
  const pagesNeedingExtraction = submission.pages.filter(
    (page) => page.extraction.status === 'pending' || page.extraction.status === 'failed'
  );
  const banner = statusBanner(submission);
  const staleExtraction = submission.status === 'extracting' && !running;
  const manualPath = !hasDraftText;

  const persistDraft = (): void => {
    if (draftText === submission.confirmedText) return;
    try {
      actions.updateSubmission(submission.id, (current) => ({
        ...current,
        confirmedText: draftText,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the draft text.';
      setLocalError(message);
    }
  };

  const handleExtract = async (): Promise<void> => {
    setRunning(true);
    setLocalError(null);
    try {
      await runExtraction(submission, { consent });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Extraction could not be run.';
      setLocalError(message);
    } finally {
      setRunning(false);
    }
  };

  const handleConfirm = (): void => {
    if (draftText.trim().length === 0) {
      setLocalError('Type the text (or transcribe it manually) before confirming.');
      return;
    }
    if (needsReview && !reviewed) {
      setLocalError('Review the flagged pages first — tick the box above the confirm button.');
      return;
    }
    const quality: EvidenceQuality = !hasDraftText
      ? 'manual'
      : draftText === joinedDrafts
        ? 'ocr_confirmed'
        : 'ocr_corrected';
    try {
      setLocalError(null);
      actions.confirmText(
        submission.id,
        { text: draftText, evidenceQuality: quality, markReviewed: needsReview }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not confirm the text.';
      setLocalError(message);
    }
  };

  return (
    <Card elevation={1} padding="md" data-testid="extraction-review">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Review the text</h2>
          <p className="text-sm text-ink-muted">
            {ocrConfigured === false
              ? 'Automatic extraction is not configured on this server — type what the pages say below.'
              : ocrProvider
                ? `Automatic extraction via ${ocrProvider} — nothing is sent without your consent.`
                : 'Extract the pages automatically, or transcribe them yourself — your choice.'}
          </p>
        </div>
        <Badge
          size="sm"
          variant={
            submission.status === 'extracted'
              ? 'success'
              : submission.status === 'extraction_failed'
                ? 'danger'
                : submission.status === 'provider_unavailable'
                  ? 'warning'
                  : 'info'
          }
          data-testid="extraction-status-badge"
        >
          {submission.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {banner && (
        <div
          role="status"
          data-testid="extraction-banner"
          className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            banner.tone === 'danger'
              ? 'border-coral-200 bg-coral-50 text-coral-700'
              : banner.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : banner.tone === 'success'
                  ? 'border-teal-200 bg-teal-50 text-teal-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {banner.tone === 'danger' ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ScanText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {staleExtraction && (
        <div
          role="status"
          data-testid="extraction-stale"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          Extraction did not finish (the page may have been reloaded). Retry it below — your pages
          are saved.
        </div>
      )}

      {localError && (
        <p className="mb-3 text-sm text-coral-600" role="alert" data-testid="extraction-error">
          {localError}
        </p>
      )}

      {submission.pages.length > 0 && (
        <ul className="mb-4 space-y-3" data-testid="page-drafts">
          {submission.pages.map((page) => (
            <li
              key={page.resourceId}
              className="rounded-xl border border-border bg-surface p-3"
              data-testid={`page-draft-${page.page}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                <span className="text-sm font-semibold text-ink">Page {page.page}</span>
                <Badge
                  size="sm"
                  variant={
                    page.extraction.status === 'ok'
                      ? 'success'
                      : page.extraction.status === 'low_confidence'
                        ? 'warning'
                        : page.extraction.status === 'failed'
                          ? 'danger'
                          : 'default'
                  }
                >
                  {page.extraction.status === 'pending'
                    ? 'not extracted'
                    : page.extraction.status.replace(/_/g, ' ')}
                </Badge>
                {page.extraction.estimatedConfidence !== null && (
                  <Badge size="sm" variant="info">
                    {Math.round(page.extraction.estimatedConfidence * 100)}% est. confidence
                  </Badge>
                )}
                {page.extraction.status === 'low_confidence' && (
                  <Badge size="sm" variant="warning">
                    correction required
                  </Badge>
                )}
              </div>
              {page.extraction.notes.length > 0 && (
                <p className="mb-2 text-xs text-amber-700" data-testid={`page-notes-${page.page}`}>
                  Provider flagged: {page.extraction.notes.join(' · ')}
                </p>
              )}
              {page.extraction.error && (
                <p className="mb-2 text-xs text-coral-600">
                  Could not read this page: {page.extraction.error}
                </p>
              )}
              {page.extraction.text ? (
                <pre
                  className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-ink"
                  data-testid={`page-text-${page.page}`}
                >
                  {page.extraction.text}
                </pre>
              ) : (
                <p className="text-xs text-ink-subtle">
                  {page.extraction.status === 'pending'
                    ? 'Waiting for extraction.'
                    : 'No text was read from this page.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {ocrConfigured !== false && pagesNeedingExtraction.length > 0 && (
        <div className="mb-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-ink" data-testid="consent-row">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              data-testid="ocr-consent"
            />
            <span>
              Send these pages to the configured OCR provider for text extraction. Nothing leaves
              this device unless you tick this — you can always transcribe manually instead.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              loading={running}
              disabled={running || !consent || pagesNeedingExtraction.length === 0}
              leftIcon={<ScanText className="h-4 w-4" />}
              onClick={() => void handleExtract()}
              data-testid="extract-button"
            >
              {`Extract ${pagesNeedingExtraction.length} page${pagesNeedingExtraction.length === 1 ? '' : 's'}`}
            </Button>
            {!consent && (
              <span className="text-xs text-ink-subtle">
                Tick the consent box to extract automatically.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-gray-50 p-3" data-testid="confirm-block">
        <Textarea
          label={
            manualPath
              ? 'Transcribe the pages yourself'
              : 'Confirmed text — correct anything the extraction got wrong'
          }
          data-testid="confirmed-text"
          value={draftText}
          rows={6}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={persistDraft}
          hint={
            manualPath
              ? 'Automatic extraction has not run. Type what each page says — keep a "--- Page 1 ---" marker between pages if you like. Your draft is saved as you go.'
              : 'Edits here become the input evaluation reads. Page markers keep the original page boundaries.'
          }
        />

        {needsReview && (
          <label className="mt-3 flex items-start gap-2 text-sm text-ink" data-testid="review-row">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              data-testid="review-confirmed"
            />
            <span>
              I compared the extracted text above with the page images, including the pages flagged
              as low confidence.
            </span>
          </label>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
            disabled={draftText.trim().length === 0 || (needsReview && !reviewed)}
            onClick={handleConfirm}
            data-testid="confirm-text-button"
          >
            Use this text for evaluation
          </Button>
          <span className="text-xs text-ink-subtle">
            {draftText.trim().length === 0
              ? 'The text above becomes the confirmed input for evaluation.'
              : draftText === joinedDrafts && hasDraftText
                ? 'Confirming the extraction as read.'
                : 'Your corrections will be used as the confirmed text.'}
          </span>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-subtle">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Raw page drafts stay exactly as extracted (evidence); evaluation only ever reads the text
        you confirm here.
      </p>
    </Card>
  );
}
