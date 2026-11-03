// Adaptive practice — deterministic question generation and answer checking.
//
// Honesty rules:
// - No AI provider exists for practice generation in this phase, so generation
//   is a deterministic fallback: same topic + evaluation + attempts ⇒ byte
//   -identical questions and ids. `origin` is always 'deterministic' and every
//   question carries a provenance note — nothing is ever claimed to be
//   "syllabus-verified".
// - Answer checks compare against key ideas derived from the STUDENT'S OWN
//   topic title and notes. Explanations quote only those notes (verified
//   information), never invented facts.
// - Phase 2 intelligence (mastery level, candidate gaps) is consumed
//   read-only to prioritise what to practise — this module never classifies
//   gaps or computes mastery.

import { hash32 } from '../../gurugraph';
import type { GapCategory, MasteryLevel } from '../../types/gurugraph';
import type {
  AnswerCheck,
  EvaluationResult,
  PracticeAttempt,
  PracticeQuestion,
} from './handwritingTypes';
import { deriveKeyConcepts, matchConcepts, normalizeForDuplicate } from './evaluation';

export { normalizeForDuplicate };

// ---------------------------------------------------------------------------
// Tunables (exported for tests)
// ---------------------------------------------------------------------------

/** Coverage of key ideas required to pass a practice question. */
export const PASS_COVERAGE = 0.6;

/** Minimum answer length before an answer is meaningfully checked. */
export const MIN_ANSWER_LENGTH = 20;

/** Honest provenance note rendered with every generated question. */
export const PRACTICE_SOURCE_NOTE =
  'Generated from your topic, notes and recorded evidence — not syllabus-verified.';

export const PRACTICE_RULES = {
  coveragePass: 'sv.practice.coverage_pass',
  duplicate: 'sv.practice.duplicate_answer',
  locked: 'sv.practice.stretch_locked',
} as const;

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface PracticeTopicContext {
  id: string;
  title: string;
  subject: string;
  notes: string;
}

export interface TopicGapContext {
  category: GapCategory;
  reason: string;
}

/** Read-only slice of Phase 2 intelligence for the topic being practised. */
export interface TopicIntelligenceContext {
  masteryLevel: MasteryLevel;
  gaps: readonly TopicGapContext[];
}

export interface PracticeGenerationInput {
  topic: PracticeTopicContext;
  /** Latest evaluation for the submission (null when not yet evaluated). */
  evaluation: EvaluationResult | null;
  topicIntelligence: TopicIntelligenceContext | null;
  /** Attempts already recorded for this submission. */
  attempts: readonly PracticeAttempt[];
}

export interface ReassessmentInput {
  topic: PracticeTopicContext;
  /** The question the handwritten work answered, if the student recorded one. */
  question: string;
}

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

function makeQuestion(parts: {
  topicId: string;
  kind: PracticeQuestion['kind'];
  difficulty: PracticeQuestion['difficulty'];
  prompt: string;
  instructions: string;
  expectedConcepts: string[];
  derivedFrom: PracticeQuestion['derivedFrom'];
  locked?: boolean;
}): PracticeQuestion {
  return {
    id: `pq_${hash32(`${parts.topicId}|${parts.kind}|${parts.prompt}`)}`,
    topicId: parts.topicId,
    kind: parts.kind,
    difficulty: parts.difficulty,
    prompt: parts.prompt,
    instructions: parts.instructions,
    expectedConcepts: parts.expectedConcepts,
    derivedFrom: parts.derivedFrom,
    origin: 'deterministic',
    sourceNote: PRACTICE_SOURCE_NOTE,
    locked: parts.locked ?? false,
  };
}

const INSTRUCTIONS: Record<PracticeQuestion['kind'], string> = {
  recall: 'Write 3–6 sentences in your own words. Mention the key ideas explicitly — your answer is checked against them automatically, not graded by a teacher.',
  explain: 'Write a short paragraph (2–5 sentences) explaining the idea and how it links to the rest of the topic.',
  apply: 'Show your working step by step and clearly mark the final answer.',
  review: 'Write 2–4 sentences covering the parts you are least sure about, then re-read your notes to check yourself.',
  summarise: 'Write a short summary (4–8 sentences) including the key ideas and one worked example.',
};

/** Foundational questions stay in the set unless Phase 2 says the topic is secure. */
function needsFoundational(input: PracticeGenerationInput): boolean {
  const level = input.topicIntelligence?.masteryLevel;
  if (!level || level === 'insufficient_evidence' || level === 'emerging' || level === 'developing') {
    return true;
  }
  const outcome = input.evaluation?.outcome;
  return outcome === 'confirmed_error' || outcome === 'plausible_gap' || outcome === 'insufficient_evidence';
}

/**
 * Build the ordered practice set. Deterministic: pure function of its input.
 * Order runs foundational → intermediate → stretch; stretch questions are
 * generated locked and unlock after the first passing attempt.
 */
export function generatePracticeSet(input: PracticeGenerationInput): PracticeQuestion[] {
  const { topic, evaluation } = input;
  const titleConcepts = deriveKeyConcepts({ title: topic.title, notes: '' }, 4);
  const allConcepts = deriveKeyConcepts(topic, 8);
  const hasPassedAttempt = input.attempts.some((attempt) => attempt.check?.passed === true);
  const questions: PracticeQuestion[] = [];
  const seen = new Set<string>();

  const add = (question: PracticeQuestion): void => {
    if (questions.length >= 5 || seen.has(question.id)) return;
    seen.add(question.id);
    questions.push(question);
  };

  // 1. Phase 2 candidate gap for this topic → review it first (read-only use).
  const gap = input.topicIntelligence?.gaps[0];
  if (gap) {
    add(
      makeQuestion({
        topicId: topic.id,
        kind: 'review',
        difficulty: 'foundational',
        prompt: `Review ${topic.title}: write about the parts you are least sure about (your records flag this: ${gap.reason}), then check your summary against your notes.`,
        instructions: INSTRUCTIONS.review,
        expectedConcepts: allConcepts.slice(0, 4),
        derivedFrom: 'gurugraph_gap',
      })
    );
  }

  // 2. Recall — the foundation, dropped only when Phase 2 reports the topic secure.
  if (needsFoundational(input)) {
    add(
      makeQuestion({
        topicId: topic.id,
        kind: 'recall',
        difficulty: 'foundational',
        prompt: `Write down the key ideas of ${topic.title} in your own words.`,
        instructions: INSTRUCTIONS.recall,
        expectedConcepts: [...new Set([...titleConcepts, ...allConcepts])].slice(0, 6),
        derivedFrom: topic.notes.trim() ? 'topic_notes' : 'topic_title',
      })
    );
  }

  // 3. Explain — prioritise concepts the evaluation found missing, else the
  //    first key idea from the notes.
  const explainConcepts: string[] = [];
  if (evaluation?.missingConcepts.length) {
    explainConcepts.push(...evaluation.missingConcepts.slice(0, 2));
  } else if (allConcepts.length > 0) {
    explainConcepts.push(allConcepts[0]);
  }
  for (const concept of explainConcepts) {
    add(
      makeQuestion({
        topicId: topic.id,
        kind: 'explain',
        difficulty: 'intermediate',
        prompt: `Explain "${concept}" and how it connects to ${topic.title}.`,
        instructions: INSTRUCTIONS.explain,
        expectedConcepts: [concept, ...allConcepts.filter((c) => c !== concept).slice(0, 2)],
        derivedFrom: evaluation?.missingConcepts.length ? 'evaluation_gap' : 'topic_notes',
      })
    );
  }

  // 4. Apply — worked example.
  add(
    makeQuestion({
      topicId: topic.id,
      kind: 'apply',
      difficulty: 'intermediate',
      prompt: `Work through one example of ${topic.title}. Show each step and mark the final answer clearly.`,
      instructions: INSTRUCTIONS.apply,
      expectedConcepts: [...new Set([...titleConcepts, ...allConcepts])].slice(0, 6),
      derivedFrom: 'topic_notes',
    })
  );

  // 5. Stretch — locked until the first passing attempt exists.
  add(
    makeQuestion({
      topicId: topic.id,
      kind: 'summarise',
      difficulty: 'stretch',
      prompt: `Summarise ${topic.title} for a classmate who missed the lesson: include the key ideas and one worked example.`,
      instructions: INSTRUCTIONS.summarise,
      expectedConcepts: allConcepts.slice(0, 6),
      derivedFrom: 'topic_notes',
      locked: !hasPassedAttempt,
    })
  );

  return questions;
}

/**
 * A fresh question for reassessment after practice: a from-memory re-check of
 * what the handwritten work originally answered.
 */
export function generateReassessmentQuestion(input: ReassessmentInput): PracticeQuestion {
  const subject =
    input.question.trim() ||
    `show everything you know about ${input.topic.title}`;
  const prompt = `Without consulting your notes: ${subject}`;
  return makeQuestion({
    topicId: input.topic.id,
    kind: 'recall',
    difficulty: 'intermediate',
    prompt,
    instructions:
      'Answer as if for marks: show your working step by step, state the final answer, and do not look at your notes.',
    expectedConcepts: deriveKeyConcepts(input.topic, 8),
    derivedFrom: 'topic_notes',
  });
}

/** First unlocked question without a passing attempt — the one to work on now. */
export function selectActiveQuestion(
  questions: readonly PracticeQuestion[],
  attempts: readonly PracticeAttempt[]
): PracticeQuestion | null {
  for (const question of questions) {
    if (question.locked) continue;
    const passed = attempts.some(
      (attempt) => attempt.questionId === question.id && attempt.check?.passed === true
    );
    if (!passed) return question;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

function notesExcerpt(notes: string, concept: string): string | null {
  if (!notes.trim()) return null;
  const needle = concept.toLowerCase();
  const sentences = notes.split(/(?<=[.!?])\s+|\n+/);
  const hit = sentences.find((sentence) => sentence.toLowerCase().includes(needle));
  if (!hit) return null;
  const clean = hit.replace(/\s+/g, ' ').trim();
  return clean.length > 140 ? `${clean.slice(0, 139)}…` : clean;
}

/**
 * Deterministic coverage check. `explanation` quotes only the student's own
 * notes (verified information) and states the check's limits.
 */
export function checkAnswer(
  question: PracticeQuestion,
  answer: string,
  topicNotes: string
): AnswerCheck {
  const trimmed = answer.trim();
  const { matched, missing, coverage } = matchConcepts(question.expectedConcepts, trimmed);
  const graded = question.expectedConcepts.length > 0;
  const threshold = graded ? PASS_COVERAGE : 0;
  const passed = graded && trimmed.length > 0 && coverage >= PASS_COVERAGE;

  const explanationParts: string[] = [];

  if (!graded) {
    explanationParts.push(
      'No key ideas could be derived for this question, so nothing was checked automatically — compare your answer with the prompt yourself.'
    );
  } else {
    const percent = Math.round(PASS_COVERAGE * 100);
    explanationParts.push(
      `Matched ${matched.length} of ${question.expectedConcepts.length} key ideas (pass mark ${percent}%): ${matched.join(', ') || 'none'}.`
    );
    explanationParts.push(
      missing.length > 0
        ? `Not mentioned: ${missing.join(', ')}.`
        : 'Every expected key idea appears in your answer.'
    );
    if (trimmed.length < MIN_ANSWER_LENGTH) {
      explanationParts.push(
        `Your answer is ${trimmed.length} characters — too short to cover the key ideas. Aim for at least ${MIN_ANSWER_LENGTH}.`
      );
    }
    for (const concept of matched.slice(0, 3)) {
      const excerpt = notesExcerpt(topicNotes, concept);
      if (excerpt) {
        explanationParts.push(`Your notes mention "${concept}": ${excerpt}`);
      }
    }
    explanationParts.push(
      'These key ideas come from your own topic and notes — an automatic check, not a teacher’s marking.'
    );
  }

  return {
    coverage,
    matchedConcepts: matched,
    missingConcepts: missing,
    passed,
    graded,
    threshold,
    explanation: explanationParts.join(' '),
  };
}

// ---------------------------------------------------------------------------
// Attempts (creation + duplicate prevention)
// ---------------------------------------------------------------------------

/** True when the same question already has this (normalised) answer recorded. */
export function isDuplicateAttempt(
  attempts: readonly PracticeAttempt[],
  questionId: string,
  answer: string
): boolean {
  const target = normalizeForDuplicate(answer);
  if (target.length === 0) return false;
  return attempts.some(
    (attempt) =>
      attempt.questionId === questionId &&
      normalizeForDuplicate(attempt.answer) === target
  );
}

/** Deterministic attempt id — reproducible from question + answer + timestamp. */
export function attemptId(questionId: string, submittedAt: string, answer: string): string {
  return `att_${hash32(`${questionId}|${submittedAt}|${normalizeForDuplicate(answer)}`)}`;
}

export function makeAttempt(input: {
  question: PracticeQuestion;
  phase: PracticeAttempt['phase'];
  answer: string;
  check: AnswerCheck | null;
  submittedAt: string;
}): PracticeAttempt {
  return {
    id: attemptId(input.question.id, input.submittedAt, input.answer),
    questionId: input.question.id,
    phase: input.phase,
    prompt: input.question.prompt,
    answer: input.answer,
    check: input.check,
    submittedAt: input.submittedAt,
  };
}
