// Handwritten page upload validation — pure, deterministic.
// Mirrors the backend limits in routes/handwriting.ts (MAX_OCR_PAGES = 8,
// 8 MiB per page) so the student sees instant feedback that matches the
// server's own server-side validation.

import type { FileRejection, ValidatedPages, ValidationResult } from './validationTypes';

export { type FileRejection, type ValidatedPages, type ValidationResult } from './validationTypes';

/** Maximum handwritten pages per submission (matches the backend cap). */
export const MAX_PAGES = 8;

/** Maximum size per page in bytes (matches the backend data-URL cap). */
export const MAX_PAGE_SIZE = 8 * 1024 * 1024;

/** Only raster images are accepted — PDFs are documents, not written pages. */
export const ACCEPTED_PAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** `accept` value for the file input. */
export const PAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export const MAX_PAGE_SIZE_LABEL = '8MB';

export function isAcceptedPageType(type: string): boolean {
  return (ACCEPTED_PAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Validate a selection of files against the per-page rules.
 *
 * - never mutates or drops accepted files silently: everything not accepted
 *   comes back in `rejected` with a student-readable reason;
 * - `remaining` tells the caller how many more pages fit so the UI can stop
 *   accepting files instead of failing them after the fact.
 */
export function validatePageFiles(
  files: readonly File[],
  currentCount = 0
): ValidationResult {
  const accepted: ValidatedPages[] = [];
  const rejected: FileRejection[] = [];
  let usedSlots = currentCount;

  files.forEach((file, index) => {
    const key = `${file.name}#${index}`;

    if (!isAcceptedPageType(file.type)) {
      rejected.push({
        key,
        name: file.name,
        reason: `Unsupported type (${file.type || 'unknown'}) — upload JPEG, PNG or WebP images.`,
        code: 'invalid_type',
      });
      return;
    }

    if (file.size > MAX_PAGE_SIZE) {
      rejected.push({
        key,
        name: file.name,
        reason: `${formatSize(file.size)} exceeds the ${MAX_PAGE_SIZE_LABEL} per-page limit.`,
        code: 'file_too_large',
      });
      return;
    }

    if (usedSlots >= MAX_PAGES) {
      rejected.push({
        key,
        name: file.name,
        reason: `Page limit reached — a submission holds up to ${MAX_PAGES} pages.`,
        code: 'too_many_pages',
      });
      return;
    }

    usedSlots += 1;
    accepted.push({ key, file });
  });

  return {
    accepted,
    rejected,
    remaining: Math.max(0, MAX_PAGES - usedSlots),
  };
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
