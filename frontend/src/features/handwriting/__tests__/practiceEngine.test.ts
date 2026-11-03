// Test G — adaptive practice: deterministic generation, honest provenance,
// coverage-based answer checking built from the student's own notes,
// progression rules, and duplicate-submission prevention.

import { describe, expect, it } from 'vitest';
import {
  MIN_ANSWER_LENGTH,
  PASS_COVERAGE,
  PRACTICE_SOURCE_NOTE,
  checkAnswer,
  generatePracticeSet,
  generateReassessmentQuestion,
  isDuplicateAttempt,
  makeAttempt,
  selectActiveQuestion,
  type PracticeGenerationInput,
} from '../practiceEngine';
import { AT, makeCheck, makeQuestion, makeAttempt as fixtureAttempt } from './fixtures';

const TOPIC = {
  id: 'topic-1',
  title: 'Photosynthesis Light Reactions',
  subject: 'Biology',
  notes:
    'chlorophyll absorbs sunlight and converts water carbon into glucose while releasing oxygen gas as a byproduct of the reaction',
};

function input(overrides: Partial<PracticeGenerationInput> = {}): PracticeGenerationInput {
  return {
    topic: TOPIC,
    evaluation: null,
    topicIntelligence: null,
    attempts: [],
    ...overrides,
  };
}

describe('generatePracticeSet', () => {
  it('is deterministic: identical input produces identical questions and ids', () => {
    const a = generatePracticeSet(input());
    const b = generatePracticeSet(input());
    expect(a).toEqual(b);
    expect(a.map((question) => question.id)).toEqual(b.map((question) => question.id));
    expect(new Set(a.map((question) => question.id)).size).toBe(a.length);
  });

  it('labels every question with honest provenance (never syllabus-verified)', () => {
    for (const question of generatePracticeSet(input())) {
      expect(question.origin).toBe('deterministic');
      expect(question.sourceNote).toBe(PRACTICE_SOURCE_NOTE);
      expect(question.sourceNote).toContain('not syllabus-verified');
      expect(question.instructions.length).toBeGreaterThan(10);
      expect(question.expectedConcepts.length).toBeGreaterThan(0);
    }
  });

  it('prioritises a Phase 2 candidate gap as a review question (read-only input)', () => {
    const questions = generatePracticeSet(
      input({
        topicIntelligence: {
          masteryLevel: 'developing',
          gaps: [{ category: 'potential_learning_gap', reason: 'low recent check scores' }],
        },
      })
    );
    expect(questions[0].kind).toBe('review');
    expect(questions[0].derivedFrom).toBe('gurugraph_gap');
    expect(questions[0].prompt).toContain('low recent check scores');
  });

  it('drops the foundational recall question only when the topic is secure with no evaluation gap', () => {
    const secure = generatePracticeSet(
      input({
        topicIntelligence: { masteryLevel: 'secure', gaps: [] },
        evaluation: {
          outcome: 'no_gap',
          headline: '',
          observed: [],
          inferred: [],
          missingConcepts: [],
          confidence: 'medium',
          referenceUsed: true,
          answerMatch: true,
          reasoningVerified: false,
          caveat: '',
          ruleId: 'r',
          evaluatedAt: AT,
        },
      })
    );
    expect(secure.some((question) => question.kind === 'recall')).toBe(false);

    const secureButErrored = generatePracticeSet(
      input({
        topicIntelligence: { masteryLevel: 'secure', gaps: [] },
        evaluation: {
          outcome: 'confirmed_error',
          headline: '',
          observed: [],
          inferred: [],
          missingConcepts: [],
          confidence: 'high',
          referenceUsed: true,
          answerMatch: false,
          reasoningVerified: false,
          caveat: '',
          ruleId: 'r',
          evaluatedAt: AT,
        },
      })
    );
    expect(secureButErrored.some((question) => question.kind === 'recall')).toBe(true);
  });

  it('creates explain questions from the evaluation’s missing concepts', () => {
    const questions = generatePracticeSet(
      input({
        evaluation: {
          outcome: 'plausible_gap',
          headline: '',
          observed: [],
          inferred: [],
          missingConcepts: ['chlorophyll', 'gradient'],
          confidence: 'low',
          referenceUsed: false,
          answerMatch: null,
          reasoningVerified: false,
          caveat: '',
          ruleId: 'r',
          evaluatedAt: AT,
        },
      })
    );
    const explain = questions.find((question) => question.kind === 'explain');
    expect(explain).toBeDefined();
    expect(explain?.derivedFrom).toBe('evaluation_gap');
    expect(explain?.prompt).toContain('chlorophyll');
  });

  it('locks the stretch question until the first passing attempt exists', () => {
    const before = generatePracticeSet(input());
    const stretchBefore = before.find((question) => question.difficulty === 'stretch');
    expect(stretchBefore?.locked).toBe(true);

    const after = generatePracticeSet(
      input({
        attempts: [
          { id: 'a1', questionId: before[0].id, phase: 'practice', prompt: before[0].prompt, answer: 'x', check: makeCheck({ passed: true }), submittedAt: AT },
        ],
      })
    );
    const stretchAfter = after.find((question) => question.difficulty === 'stretch');
    expect(stretchAfter?.locked).toBe(false);
  });

  it('never emits the reserved confirmed_misconception category into questions', () => {
    const questions = generatePracticeSet(
      input({
        topicIntelligence: {
          masteryLevel: 'emerging',
          gaps: [{ category: 'confirmed_misconception', reason: 'should never be produced in Phase 2' }],
        },
      })
    );
    expect(questions[0].prompt).not.toContain('confirmed misconception');
  });
});

describe('selectActiveQuestion', () => {
  it('returns the first unlocked question without a passing attempt', () => {
    const questions = generatePracticeSet(input());
    expect(selectActiveQuestion(questions, [])).toEqual(questions[0]);

    const passed = [
      { id: 'a1', questionId: questions[0].id, phase: 'practice' as const, prompt: questions[0].prompt, answer: 'y', check: makeCheck({ passed: true }), submittedAt: AT },
    ];
    expect(selectActiveQuestion(questions, passed)?.id).toBe(
      questions.find((question) => !question.locked && question.id !== questions[0].id)?.id
    );
  });

  it('skips locked questions and returns null when everything unlocked has passed', () => {
    const questions = generatePracticeSet(input());
    const attempts = questions
      .filter((question) => !question.locked)
      .map((question, index) => ({
        id: `a${index}`,
        questionId: question.id,
        phase: 'practice' as const,
        prompt: question.prompt,
        answer: 'z',
        check: makeCheck({ passed: true }),
        submittedAt: AT,
      }));
    expect(selectActiveQuestion(questions, attempts)).toBeNull();
  });

  it('a failed attempt keeps the question active so the student can revise it', () => {
    const questions = generatePracticeSet(input());
    const failed = [
      { id: 'a1', questionId: questions[0].id, phase: 'practice' as const, prompt: questions[0].prompt, answer: 'nope', check: makeCheck({ passed: false }), submittedAt: AT },
    ];
    expect(selectActiveQuestion(questions, failed)?.id).toBe(questions[0].id);
  });
});

describe('checkAnswer', () => {
  const question = makeQuestion({ expectedConcepts: ['photosynthesis', 'chlorophyll', 'sunlight'] });

  it('passes when the answer covers enough key ideas, with the notes as explanation', () => {
    const check = checkAnswer(
      question,
      'Photosynthesis uses chlorophyll to capture sunlight and store energy.',
      'During photosynthesis chlorophyll absorbs sunlight in the leaf.'
    );
    expect(check.graded).toBe(true);
    expect(check.threshold).toBe(PASS_COVERAGE);
    expect(check.passed).toBe(check.coverage >= PASS_COVERAGE);
    expect(check.matchedConcepts).toContain('photosynthesis');
    expect(check.explanation).toContain('Matched');
    expect(check.explanation).toContain('Your notes mention');
    expect(check.explanation).toContain('not a teacher');
  });

  it('fails (without inventing facts) when key ideas are missing', () => {
    const check = checkAnswer(question, 'I did not mention the ideas at all.', TOPIC.notes);
    expect(check.passed).toBe(false);
    expect(check.missingConcepts.length).toBeGreaterThan(0);
    expect(check.explanation).toContain('Not mentioned');
  });

  it('flags answers that are too short to cover anything meaningful', () => {
    const check = checkAnswer(question, 'ok', TOPIC.notes);
    expect(check.passed).toBe(false);
    expect(check.explanation).toContain(String(MIN_ANSWER_LENGTH));
  });

  it('is ungraded (never passed) when no key ideas could be derived', () => {
    const empty = makeQuestion({ expectedConcepts: [] });
    const check = checkAnswer(empty, 'anything at all', '');
    expect(check.graded).toBe(false);
    expect(check.passed).toBe(false);
    expect(check.threshold).toBe(0);
    expect(check.explanation).toContain('nothing was checked automatically');
  });

  it('is deterministic for the same question, answer and notes', () => {
    expect(checkAnswer(question, 'photosynthesis with chlorophyll and sunlight', TOPIC.notes)).toEqual(
      checkAnswer(question, 'photosynthesis with chlorophyll and sunlight', TOPIC.notes)
    );
  });
});

describe('duplicate prevention', () => {
  it('detects a re-submission of the same normalised answer', () => {
    const attempts = [
      fixtureAttempt({ questionId: 'pq-9', answer: 'The answer is 6.' }),
    ];
    expect(isDuplicateAttempt(attempts, 'pq-9', 'the answer is 6')).toBe(true);
    expect(isDuplicateAttempt(attempts, 'pq-9', 'The   answer is 6!')).toBe(true);
    expect(isDuplicateAttempt(attempts, 'pq-9', 'the answer is 7')).toBe(false);
    expect(isDuplicateAttempt(attempts, 'pq-other', 'The answer is 6.')).toBe(false);
    expect(isDuplicateAttempt([], 'pq-9', 'anything')).toBe(false);
  });

  it('does not treat two different empty answers as duplicates', () => {
    expect(isDuplicateAttempt([fixtureAttempt({ answer: '' })], 'pq-1', '   ')).toBe(false);
  });

  it('attempt ids are deterministic per question, answer and timestamp', () => {
    const first = makeAttempt({
      question: makeQuestion({ id: 'pq-1' }),
      phase: 'practice',
      answer: 'same',
      check: null,
      submittedAt: AT,
    });
    const again = makeAttempt({
      question: makeQuestion({ id: 'pq-1' }),
      phase: 'practice',
      answer: 'same',
      check: null,
      submittedAt: AT,
    });
    const other = makeAttempt({
      question: makeQuestion({ id: 'pq-1' }),
      phase: 'practice',
      answer: 'same',
      check: null,
      submittedAt: '2026-10-02T00:00:00.000Z',
    });
    expect(first.id).toBe(again.id);
    expect(first.id).not.toBe(other.id);
  });
});

describe('generateReassessmentQuestion', () => {
  it('produces a from-memory re-check that differs from practice questions', () => {
    const practice = generatePracticeSet(input());
    const reassessment = generateReassessmentQuestion({ topic: TOPIC, question: 'Solve 2x + 5 = 17' });
    expect(reassessment.prompt).toContain('Without consulting your notes');
    expect(reassessment.prompt).toContain('Solve 2x + 5 = 17');
    expect(reassessment.instructions).toContain('do not look at your notes');
    expect(practice.map((question) => question.id)).not.toContain(reassessment.id);
    expect(reassessment.origin).toBe('deterministic');
  });

  it('falls back to the topic title when no question was recorded', () => {
    const reassessment = generateReassessmentQuestion({ topic: TOPIC, question: '  ' });
    expect(reassessment.prompt).toContain(TOPIC.title);
  });
});
