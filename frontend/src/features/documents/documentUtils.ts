// Shared helpers for the Documents feature.

import { documentKind } from '../../services/resourceStore';
import type { Resource } from '../../types/api';

export { documentKind };

/** Human-readable type label shown on a document card. */
export function documentKindLabel(resource: Resource): string {
  if (documentKind(resource) === 'pdf') return 'PDF';
  const subtype = resource.mimeType.split('/')[1] || 'image';
  return subtype.replace('jpeg', 'JPG').toUpperCase();
}

export function formatDocumentSize(size: string | number): string {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
