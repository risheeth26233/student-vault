// Extraction orchestration — turns the OCR API into submission pipeline state.
//
// Responsibilities (typed boundary between storage, provider and records):
// - select pages that still need extraction (pending/failed only — already
//   read pages are never silently re-sent),
// - load page blobs as data URLs (injectable for tests),
// - request extraction with explicit consent,
// - map per-page provider results onto the submission, preserving page order
//   and per-page status/confidence/notes,
// - classify every failure honestly:
//     provider_unavailable → manual transcription path (server unreachable,
//                            not signed in, no provider configured, consent
//                            withheld) — never presented as a processing error,
//     failed               → the provider ran but produced no usable text;
//                            retryable.

import type { OcrPageInput, OcrPageResult, OcrExtractResponse } from '../../types/api';
import { handwritingApi } from '../../services/api';
import { getResource } from '../../services/resourceStore';
import { updateSubmission } from '../../services/handwritingStore';
import type {
  ExtractionRunResult,
  HandwritingSubmission,
  PageExtraction,
  SubmissionPage,
} from './handwritingTypes';

// ---------------------------------------------------------------------------
// Dependencies (injectable so tests never need IndexedDB or a live server)
// ---------------------------------------------------------------------------

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the saved page image.'));
    reader.readAsDataURL(blob);
  });
}

/** Default page loader: IndexedDB data URL first, then the R2 download URL. */
export async function loadPageDataUrl(resourceId: string): Promise<string | null> {
  const resource = await getResource(resourceId);
  if (resource.data && resource.data.startsWith('data:')) return resource.data;
  if (resource.downloadUrl) {
    const response = await fetch(resource.downloadUrl);
    if (!response.ok) {
      throw new Error(`Could not fetch the saved page image (HTTP ${response.status}).`);
    }
    return blobToDataUrl(await response.blob());
  }
  return resource.data || null;
}

export interface ExtractionDeps {
  loadPageDataUrl: (resourceId: string) => Promise<string | null>;
  requestExtract: (params: {
    pages: OcrPageInput[];
    consent: boolean;
  }) => Promise<OcrExtractResponse>;
  now: () => string;
}

const defaultDeps: ExtractionDeps = {
  loadPageDataUrl,
  requestExtract: (params) => handwritingApi.extract(params),
  now: () => new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

interface ClassifiableError {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Decide which honest pipeline state an extraction error maps to.
 * Anything meaning "automatic extraction cannot run right now" is
 * `provider_unavailable` (manual path); everything else is `failed` (retry).
 */
export function classifyExtractError(error: unknown): ExtractionRunResult {
  const err = (error ?? {}) as ClassifiableError;
  const message =
    typeof err.message === 'string' && err.message.trim().length > 0
      ? err.message
      : 'Text extraction failed unexpectedly.';

  if (err.code === 'ocr_unavailable') {
    return { kind: 'provider_unavailable', message };
  }
  if (err.status === undefined) {
    // fetch() rejected — the backend is unreachable. Not a provider failure.
    return {
      kind: 'provider_unavailable',
      message: `Could not reach the server for automatic extraction (${message}). Your pages are saved — type the text in manually instead.`,
    };
  }
  if (err.status === 401 || err.status === 403) {
    return {
      kind: 'provider_unavailable',
      message: 'Sign in to use automatic extraction — or type the text in manually.',
    };
  }
  if (err.status === 503) {
    return { kind: 'provider_unavailable', message };
  }
  return {
    kind: 'failed',
    message: `${message} You can retry, or type the text in manually.`,
  };
}

// ---------------------------------------------------------------------------
// Extraction run
// ---------------------------------------------------------------------------

function failedExtraction(error: string, at: string): PageExtraction {
  return {
    status: 'failed',
    text: '',
    estimatedConfidence: null,
    notes: [],
    provider: null,
    error,
    extractedAt: at,
  };
}

function fromOcrResult(result: OcrPageResult, provider: string, at: string): PageExtraction {
  return {
    status: result.status,
    text: result.text,
    estimatedConfidence: result.estimatedConfidence,
    notes: result.notes,
    provider,
    error: result.error,
    extractedAt: at,
  };
}

/** Only pending/failed pages are sent — confirmed text is never re-requested. */
function pagesNeedingExtraction(submission: HandwritingSubmission): SubmissionPage[] {
  return submission.pages.filter(
    (page) => page.extraction.status === 'pending' || page.extraction.status === 'failed'
  );
}

/**
 * Join per-page drafts into one editable text while preserving page
 * boundaries (`--- Page N ---` markers), so corrections stay attributable.
 */
export function joinDraftText(pages: readonly SubmissionPage[]): string {
  return [...pages]
    .sort((a, b) => a.page - b.page)
    .map((page) => `--- Page ${page.page} ---\n${page.extraction.text.trim()}`)
    .join('\n\n')
    .trim();
}

/**
 * True when at least one page actually carries extracted text. Header-only
 * joins (`--- Page N ---` over an empty page) do not count — manual
 * transcription must never be mistaken for a corrected extraction.
 */
export function anyExtractionText(pages: readonly SubmissionPage[]): boolean {
  return pages.some((page) => page.extraction.text.trim().length > 0);
}

function overallStatus(pages: readonly SubmissionPage[]): {
  status: HandwritingSubmission['status'];
  message: string | null;
} {
  if (pages.length === 0) return { status: 'draft', message: null };
  const withText = pages.filter(
    (page) => page.extraction.status === 'ok' || page.extraction.status === 'low_confidence'
  );
  const failed = pages.filter((page) => page.extraction.status === 'failed');
  const unavailable = failed.filter((page) => page.extraction.error === 'ocr_unavailable');

  if (withText.length === 0) {
    if (unavailable.length === failed.length && unavailable.length > 0) {
      return {
        status: 'provider_unavailable',
        message: 'No OCR provider is available on the server — transcribe the pages manually.',
      };
    }
    return {
      status: 'extraction_failed',
      message: `No page could be read (${failed.length} failed) — retry, or transcribe manually.`,
    };
  }
  if (failed.length > 0) {
    return {
      status: 'extracted',
      message: `${failed.length} of ${pages.length} page(s) could not be read — retry them or type those pages in manually before evaluating.`,
    };
  }
  return { status: 'extracted', message: null };
}

export interface ExtractionRunOutcome {
  result: ExtractionRunResult;
  submission: HandwritingSubmission;
}

/**
 * Run one extraction pass over the submission's unread pages.
 * Always persists the resulting state — success, unavailable or failure — so a
 * reload never loses progress and every outcome stays visible.
 */
export async function runExtraction(
  submission: HandwritingSubmission,
  options: { consent: boolean },
  overrides: Partial<ExtractionDeps> = {}
): Promise<ExtractionRunOutcome> {
  const deps: ExtractionDeps = { ...defaultDeps, ...overrides };
  const apply = (
    updater: (current: HandwritingSubmission) => HandwritingSubmission
  ): HandwritingSubmission =>
    updateSubmission(submission.id, updater, deps.now) ?? submission;

  const extracting = apply((current) => ({
    ...current,
    status: 'extracting',
    extractionMessage: null,
  }));

  const pending = pagesNeedingExtraction(extracting);

  if (pending.length === 0) {
    return {
      result: { kind: 'success', message: 'Every page already has extracted text.' },
      submission: extracting,
    };
  }

  // Consent is a hard gate: without it, nothing leaves the device.
  if (options.consent !== true) {
    const updated = apply((current) => ({
      ...current,
      status: 'provider_unavailable',
      extractionMessage:
        'Automatic extraction was not run because you did not consent to sending these pages — type the text in manually.',
    }));
    return {
      result: {
        kind: 'provider_unavailable',
        message:
          'Automatic extraction was not run because you did not consent to sending these pages — type the text in manually.',
      },
      submission: updated,
    };
  }

  // Load page data (a missing blob fails that page, not the whole run).
  const pageInputs: OcrPageInput[] = [];
  const loadFailures = new Map<string, PageExtraction>();
  for (const page of pending) {
    try {
      const dataUrl = await deps.loadPageDataUrl(page.resourceId);
      if (!dataUrl) throw new Error('empty');
      pageInputs.push({ id: page.resourceId, dataUrl });
    } catch {
      loadFailures.set(page.resourceId, failedExtraction('page_data_unavailable', deps.now()));
    }
  }

  if (pageInputs.length === 0) {
    const updated = apply((current) => ({
      ...current,
      status: 'extraction_failed',
      extractionMessage:
        'The saved page images could not be read for extraction — retry, or remove and re-add those pages.',
      pages: current.pages.map((page) =>
        loadFailures.has(page.resourceId)
          ? { ...page, extraction: loadFailures.get(page.resourceId) as PageExtraction }
          : page
      ),
    }));
    return {
      result: {
        kind: 'failed',
        message:
          'The saved page images could not be read for extraction — retry, or remove and re-add those pages.',
      },
      submission: updated,
    };
  }

  let response: OcrExtractResponse;
  try {
    response = await deps.requestExtract({ pages: pageInputs, consent: true });
  } catch (error) {
    const classified = classifyExtractError(error);
    const updated = apply((current) => ({
      ...current,
      status: classified.kind === 'provider_unavailable' ? 'provider_unavailable' : 'extraction_failed',
      extractionMessage: classified.message,
      pages: current.pages.map((page) =>
        loadFailures.has(page.resourceId)
          ? { ...page, extraction: loadFailures.get(page.resourceId) as PageExtraction }
          : page
      ),
    }));
    return { result: classified, submission: updated };
  }

  const byId = new Map(response.pages.map((result) => [result.id, result]));
  // Pages already read in an earlier run were deliberately not re-sent — they
  // must never be overwritten by this run's merge.
  const sentIds = new Set(pageInputs.map((input) => input.id));
  const at = deps.now();

  const updated = apply((current) => {
    const pages: SubmissionPage[] = current.pages.map((page) => {
      if (loadFailures.has(page.resourceId)) {
        return { ...page, extraction: loadFailures.get(page.resourceId) as PageExtraction };
      }
      if (!sentIds.has(page.resourceId)) return page; // untouched this run
      const result = byId.get(page.resourceId);
      if (!result) {
        return { ...page, extraction: failedExtraction('missing_page_result', at) };
      }
      return { ...page, extraction: fromOcrResult(result, response.provider, at) };
    });
    const { status, message } = overallStatus(pages);
    return { ...current, status, extractionMessage: message, pages };
  });

  const finalStatus = updated.status;
  if (finalStatus === 'provider_unavailable') {
    return {
      result: {
        kind: 'provider_unavailable',
        message: updated.extractionMessage ?? 'Automatic extraction is unavailable.',
      },
      submission: updated,
    };
  }
  if (finalStatus === 'extraction_failed') {
    return {
      result: {
        kind: 'failed',
        message: updated.extractionMessage ?? 'Extraction produced no usable text.',
      },
      submission: updated,
    };
  }
  return {
    result: {
      kind: 'success',
      message: updated.extractionMessage ?? 'Text extracted — review each page before evaluating.',
    },
    submission: updated,
  };
}
