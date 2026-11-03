// Test F — evaluation states: all six outcomes are distinguishable, every
// result separates observed facts from inference, matching final answers are
// never presented as verified reasoning, and `confirmed_misconception` is
// never produced.

import { describe, expect, it } from 'vitest';
import {
  EVALUATION_OUTCOME_LABEL,
  EVALUATION_RULES,
  deriveKeyConcepts,
  evaluateSubmission,
  matchConcepts,
  normalizeAnswerText,
  textSimilarity,
} from '../evaluation';
import type { EvaluationOutcome } from '../handwritingTypes';
import { AT, makePage } from './fixtures';

const TOPIC = {
  title: 'Photosynthesis Light Reactions',
  notes:
    'chlorophyll absorbs sunlight and converts water carbon into glucose while releasing oxygen gas as a byproduct of the reaction',
};

function evaluate(overrides: Partial<Parameters<typeof evaluateSubmission>[0]> = {}) {
  return evaluateSubmission({
    pages: [makePage({ extraction: { status: 'ok', text: 'x', estimatedConfidence: 1, notes: [], provider: 'test' } })],
    confirmedText: '',
    topic: TOPIC,
    referenceAnswer: '',
    now: () => AT,
    ...overrides,
  });
}

const ALL_OUTCOMES: EvaluationOutcome[] = [
  'confirmed_error',
  'plausible_gap',
  'insufficient_evidence',
  'extraction_failure',
  'evaluation_unavailable',
  'no_gap',
];

describe('evaluateSubmission — the six distinguishable states', () => {
  it('reports extraction_failure when text is empty and a page failed', () => {
    const result = evaluate({
      pages: [makePage({ extraction: { status: 'failed', text: '', estimatedConfidence: null, notes: [], provider: null, error: 'provider_error' } })],
      confirmedText: '   ',
    });
    expect(result.outcome).toBe('extraction_failure');
    expect(result.confidence).toBe('none');
  });

  it('reports insufficient_evidence for empty or too-short confirmed text', () => {
    const empty = evaluate({ confirmedText: '' });
    expect(empty.outcome).toBe('insufficient_evidence');

    const short = evaluate({ confirmedText: 'x = 6' });
    expect(short.outcome).toBe('insufficient_evidence');
    expect(short.observed.join(' ')).toContain('character(s)');
    expect(short.caveat).toContain('No conclusion about correctness');
  });

  it('reports evaluation_unavailable when there is nothing to compare against', () => {
    const result = evaluate({
      confirmedText: 'A long write-up that clears the minimum text length requirement comfortably.',
      topic: { title: 'a b c', notes: '' },
      referenceAnswer: '',
    });
    expect(result.outcome).toBe('evaluation_unavailable');
    expect(result.caveat).toContain('not a judgement of the work');
  });

  it('reports confirmed_error on a definite numeric mismatch', () => {
    const result = evaluate({
      confirmedText: 'step one\nstep two\nx = 7',
      referenceAnswer: 'x = 6',
    });
    expect(result.outcome).toBe('confirmed_error');
    expect(result.answerMatch).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.ruleId).toBe(EVALUATION_RULES.confirmedError);
    expect(result.caveat).toContain('not that every step');
  });

  it('reports confirmed_error on low text similarity to the reference', () => {
    const result = evaluate({
      confirmedText: 'completely different content that shares nothing with the reference at all',
      referenceAnswer: 'The mitochondria is the powerhouse of the cell producing ATP energy',
    });
    expect(result.outcome).toBe('confirmed_error');
    expect(result.answerMatch).toBe(false);
  });

  it('reports no_gap for a matching final answer and never claims reasoning was verified', () => {
    const result = evaluate({
      confirmedText: 'first line of working\nsecond line\nx = 6',
      referenceAnswer: 'x = 6',
    });
    expect(result.outcome).toBe('no_gap');
    expect(result.answerMatch).toBe(true);
    expect(result.reasoningVerified).toBe(false);
    expect(result.inferred.join(' ')).toContain('does NOT prove');
    expect(result.observed.join(' ')).toContain('intermediate steps were not verified');
    expect(result.caveat).toContain('Intermediate reasoning was not verified');
  });

  it('downgrades a match with too many missing reference parts to a plausible gap', () => {
    const result = evaluate({
      confirmedText: 'x = 6',
      referenceAnswer: 'start with the equation\nisolate the variable\ndivide both sides\ncheck the answer\nx = 6',
    });
    expect(result.outcome).toBe('plausible_gap');
    expect(result.answerMatch).toBe(true);
    expect(result.missingConcepts.length).toBeGreaterThan(2);
    expect(result.caveat).toContain('Candidate finding from text comparison');
  });

  it('reports a low-confidence no_gap from coverage of the topic notes', () => {
    const concepts = deriveKeyConcepts(TOPIC);
    expect(concepts.length).toBeGreaterThanOrEqual(3);
    const answer = [...concepts, 'and the full explanation written out here in the answer'].join(' ');
    const result = evaluate({ confirmedText: answer });
    expect(result.outcome).toBe('no_gap');
    expect(result.confidence).toBe('low');
    expect(result.referenceUsed).toBe(false);
    expect(result.answerMatch).toBeNull();
    expect(result.caveat).toContain('Without a reference answer');
  });

  it('reports a low-confidence plausible gap when key notes ideas are absent', () => {
    const result = evaluate({
      confirmedText:
        'I wrote something long enough to pass the length check but avoided every key idea from the notes entirely on purpose',
    });
    expect(result.outcome).toBe('plausible_gap');
    expect(result.confidence).toBe('low');
    expect(result.missingConcepts.length).toBeGreaterThan(0);
    expect(result.caveat).toContain('not a confirmed mistake');
  });

  it('never emits the reserved confirmed_misconception state', () => {
    const results = [
      evaluate({ confirmedText: '' }),
      evaluate({ confirmedText: '', pages: [makePage({ extraction: { status: 'failed', text: '', estimatedConfidence: null, notes: [], provider: null } })] }),
      evaluate({ confirmedText: 'x = 7', referenceAnswer: 'x = 6' }),
      evaluate({ confirmedText: 'x = 6', referenceAnswer: 'x = 6' }),
      evaluate({ confirmedText: 'entirely different answer content than what the reference contains here' , referenceAnswer: 'The mitochondria is the powerhouse of the cell producing ATP energy' }),
      evaluate({ confirmedText: 'nothing relevant to the notes topic at all appears anywhere in this lengthy answer' }),
      evaluate({ confirmedText: 'anything at all', topic: { title: 'a', notes: '' } }),
    ];
    for (const result of results) {
      expect(ALL_OUTCOMES).toContain(result.outcome);
      expect(result.outcome).not.toBe('confirmed_misconception');
      expect(result.reasoningVerified).toBe(false);
    }
  });

  it('keeps every label distinct and covers all six states', () => {
    const labels = ALL_OUTCOMES.map((outcome) => EVALUATION_OUTCOME_LABEL[outcome]);
    expect(new Set(labels).size).toBe(6);
  });

  it('is deterministic: same input and clock ⇒ identical result', () => {
    const input = {
      confirmedText: 'x = 6',
      referenceAnswer: 'x = 6',
      topic: TOPIC,
      now: () => AT,
    };
    expect(evaluateSubmission({ ...input, pages: [makePage()] })).toEqual(
      evaluateSubmission({ ...input, pages: [makePage()] })
    );
  });
});

describe('helpers', () => {
  it('normalizeAnswerText collapses case, whitespace and punctuation', () => {
    expect(normalizeAnswerText('  X   =  6! ')).toBe(normalizeAnswerText('x = 6'));
  });

  it('textSimilarity is 1 for identical sets and low for disjoint text', () => {
    expect(textSimilarity('alpha beta gamma delta', 'alpha beta gamma delta')).toBe(1);
    expect(textSimilarity('alpha beta gamma delta', 'omega sigma theta iota')).toBeLessThan(0.4);
  });

  it('matchConcepts reports matched, missing and 4dp coverage', () => {
    const result = matchConcepts(['alpha', 'beta', 'gamma'], 'alpha and beta only');
    expect(result.matched).toEqual(['alpha', 'beta']);
    expect(result.missing).toEqual(['gamma']);
    expect(result.coverage).toBe(0.6667);
    expect(matchConcepts([], 'anything').coverage).toBe(0);
  });

  it('deriveKeyConcepts filters short and stopword tokens, title before notes', () => {
    const concepts = deriveKeyConcepts({ title: 'Quantum Mechanics Rules', notes: 'energy levels and orbitals' });
    expect(concepts[0]).toContain('quantum');
    expect(concepts).not.toContain('and');
    expect(deriveKeyConcepts({ title: 'a b', notes: '' })).toEqual([]);
  });
});
