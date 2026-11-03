import { describe, expect, it } from 'vitest';
import { buildLocalPracticePrompt, buildOfflineStudyGuide } from '../offlineStudyGuide';

describe('buildOfflineStudyGuide', () => {
  it('clearly labels local guidance and uses only local topic notes', () => {
    const result = buildOfflineStudyGuide({ subject: 'Biology', title: 'Cells', notes: 'Mitochondria release energy.' });
    expect(result).toContain('Offline study scaffold');
    expect(result).toContain('Biology — Cells');
    expect(result).toContain('Mitochondria release energy.');
    expect(result).toContain('has not generated or verified an answer');
  });
  it('works without a selected topic or notes', () => {
    expect(buildOfflineStudyGuide(undefined)).toContain('No topic selected');
  });
  it('creates a note-grounded prompt with progressive hints without claiming an answer', () => {
    const practice = buildLocalPracticePrompt({ subject: 'Biology', title: 'Cells', notes: 'Mitochondria release energy for cellular processes.' });
    expect(practice.prompt).toContain('Mitochondria release energy');
    expect(practice.hints).toHaveLength(3);
  });
});
