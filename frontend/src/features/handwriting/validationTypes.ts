// Shared result shapes for handwritten page upload validation.

export interface ValidatedPages {
  /** Stable per-selection key (name + index) used for React keys/errors. */
  key: string;
  file: File;
}

export type FileRejectionCode = 'invalid_type' | 'file_too_large' | 'too_many_pages';

export interface FileRejection {
  key: string;
  name: string;
  /** Student-readable explanation — never a silent drop. */
  reason: string;
  code: FileRejectionCode;
}

export interface ValidationResult {
  accepted: ValidatedPages[];
  rejected: FileRejection[];
  /** How many more pages fit after this selection. */
  remaining: number;
}
