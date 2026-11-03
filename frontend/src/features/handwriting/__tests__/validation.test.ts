// @vitest-environment jsdom
// Test A — upload validation: type, size and page-count limits with
// student-readable rejection reasons (never a silent drop).

import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_PAGE_TYPES,
  MAX_PAGES,
  MAX_PAGE_SIZE,
  formatSize,
  isAcceptedPageType,
  validatePageFiles,
} from '../validation';
import { fakeFile } from './fixtures';

describe('validatePageFiles', () => {
  it('accepts JPEG, PNG and WebP images', () => {
    for (const type of ACCEPTED_PAGE_TYPES) {
      const file = fakeFile(`ok.${type.split('/')[1]}`, type, 1024);
      const result = validatePageFiles([file], 0);
      expect(result.accepted).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
      expect(result.remaining).toBe(MAX_PAGES - 1);
    }
  });

  it('rejects unsupported types with an explicit reason', () => {
    const pdf = fakeFile('notes.pdf', 'application/pdf', 1000);
    const result = validatePageFiles([pdf], 0);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].code).toBe('invalid_type');
    expect(result.rejected[0].reason).toContain('application/pdf');
    expect(result.rejected[0].reason).toContain('JPEG, PNG or WebP');
    expect(result.rejected[0].name).toBe('notes.pdf');
  });

  it('rejects files over the per-page limit with the sizes in the reason', () => {
    const big = fakeFile('big.png', 'image/png', MAX_PAGE_SIZE + 1);
    const small = fakeFile('small.png', 'image/png', MAX_PAGE_SIZE);
    const result = validatePageFiles([big, small], 0);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].code).toBe('file_too_large');
    expect(result.rejected[0].reason).toContain('8MB');
    expect(result.rejected[0].reason).toContain(formatSize(MAX_PAGE_SIZE + 1));
  });

  it('enforces the page cap against existing pages and stops accepting', () => {
    const files = Array.from({ length: 4 }, (_, index) =>
      fakeFile(`p${index}.jpg`, 'image/jpeg', 512)
    );
    // Two slots left of MAX_PAGES ⇒ exactly two accepted, rest rejected.
    const result = validatePageFiles(files, MAX_PAGES - 2);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.every((entry) => entry.code === 'too_many_pages')).toBe(true);
    expect(result.rejected[0].reason).toContain(String(MAX_PAGES));
  });

  it('gives every accepted file a unique key', () => {
    const same = [fakeFile('dup.jpg', 'image/jpeg', 10), fakeFile('dup.jpg', 'image/jpeg', 10)];
    const result = validatePageFiles(same, 0);
    expect(result.accepted).toHaveLength(2);
    expect(new Set(result.accepted.map((entry) => entry.key)).size).toBe(2);
  });

  it('isAcceptedPageType matches the accepted list exactly', () => {
    expect(isAcceptedPageType('image/jpeg')).toBe(true);
    expect(isAcceptedPageType('image/jpg')).toBe(false);
    expect(isAcceptedPageType('image/gif')).toBe(false);
    expect(isAcceptedPageType('')).toBe(false);
  });
});

describe('formatSize', () => {
  it('formats bytes into readable units', () => {
    expect(formatSize(512)).toBe('512B');
    expect(formatSize(2048)).toBe('2KB');
    expect(formatSize(MAX_PAGE_SIZE)).toBe('8.0MB');
  });
});
