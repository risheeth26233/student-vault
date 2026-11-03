// Adaptive practice panel — deterministic questions, honest automatic checks.
//
// Honesty rules enforced here:
// - questions are generated deterministically from the student's own topic,
//   notes and recorded evidence; every question shows its provenance note and
//   is labelled as generated, never "syllabus-verified";
// - the answer check is an automatic coverage check of key ideas from the
//   student's own notes — it says so, and it never pretends to be a teacher;
// - stretch questions unlock only after a first passing attempt;
// - the same question with the same answer cannot be submitted twice — the
//   duplicate is rejected with an explanation, never silently swallowed.

import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, HelpCircle, Lock, RefreshCw, XCircle } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Textarea } from '../../../components/ui/Input';
import { useHandwritingActions } from '../../../hooks/useHandwriting';
import {
  checkAnswer,
  generatePracticeSet,
  generateReassessmentQuestion,
  makeAttempt,
  selectActiveQuestion,
  type PracticeTopicContext,
  type TopicIntelligenceContext,
} from '../practiceEngine';
import type {
  AnswerCheck,
  EvaluationResult,
  HandwritingSubmission,
  PracticeAttempt,
  PracticeQuestion,
} from '../handwritingTypes';

function coveragePercent(check: AnswerCheck | null): number {
  return check ? Math.round(check.coverage * 100) : 0;
}

function formatTime(at: string): string {
  try {
    return new Date(at).toLocaleString();
  } catch {
    return at;
  }
}

function CheckResultView({ check, phase }: { check: AnswerCheck; phase: PracticeAttempt['phase'] }) {
  const percent = coveragePercent(check);
  return (
    <div className="space-y-2" data-testid={phase === 'reassessment' ? 'reassessment-result' : 'practice-check-result'}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={check.passed ? 'success' : 'warning'} size="sm">
          {check.passed ? 'Passed the automatic check' : 'Not passed yet'}
        </Badge>
        <Badge variant="default" size="sm">
          coverage {percent}%
        </Badge>
        {!check.graded && (
          <Badge variant="info" size="sm">
            not automatically graded
          </Badge>
        )}
      </div>
      {check.graded && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${check.passed ? 'bg-teal-500' : 'bg-amber-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {check.matchedConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {check.matchedConcepts.map((concept) => (
            <Badge key={`m-${concept}`} variant="success" size="sm">
              {concept}
            </Badge>
          ))}
          {check.missingConcepts.map((concept) => (
            <Badge key={`x-${concept}`} variant="warning" size="sm">
              {concept}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-sm text-ink-muted" data-testid="check-explanation">
        {check.explanation}
      </p>
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: PracticeAttempt }) {
  return (
    <li
      className="rounded-lg border border-border bg-surface px-3 py-2"
      data-testid={`attempt-${attempt.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={attempt.phase === 'reassessment' ? 'info' : 'default'} size="sm">
          {attempt.phase === 'reassessment' ? 'reassessment' : 'practice'}
        </Badge>
        {attempt.check ? (
          attempt.check.graded ? (
            <Badge variant={attempt.check.passed ? 'success' : 'warning'} size="sm">
              {coveragePercent(attempt.check)}% coverage
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              recorded
            </Badge>
          )
        ) : (
          <Badge variant="default" size="sm">
            no automatic check
          </Badge>
        )}
        <span className="text-xs text-ink-subtle">{formatTime(attempt.submittedAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ink">{attempt.prompt}</p>
    </li>
  );
}

export interface PracticePanelProps {
  submission: HandwritingSubmission;
  topicContext: PracticeTopicContext;
  /** Read-only Phase 2 intelligence for this topic (null while unknown). */
  topicIntelligence: TopicIntelligenceContext | null;
}

export function PracticePanel({
  submission,
  topicContext,
  topicIntelligence,
}: PracticePanelProps) {
  const actions = useHandwritingActions();
  const attempts = submission.attempts;
  const evaluation: EvaluationResult | null = submission.evaluation;

  const questions = useMemo<PracticeQuestion[]>(
    () => generatePracticeSet({ topic: topicContext, evaluation, topicIntelligence, attempts }),
    [topicContext, evaluation, topicIntelligence, attempts]
  );
  const activeQuestion = useMemo(
    () => selectActiveQuestion(questions, attempts),
    [questions, attempts]
  );

  const reassessmentQuestion = useMemo(
    () => generateReassessmentQuestion({ topic: topicContext, question: submission.question }),
    [topicContext, submission.question]
  );

  const [answer, setAnswer] = useState('');
  const [reassessmentAnswer, setReassessmentAnswer] = useState('');
  const [showReassessment, setShowReassessment] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  // Reset the answer box whenever the active question changes.
  useEffect(() => {
    setAnswer('');
    setLocalError(null);
    setDuplicate(null);
  }, [activeQuestion?.id]);

  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const passedCount = attempts.filter((attempt) => attempt.check?.passed).length;
  const reassessmentEnabled = evaluation !== null || attempts.length > 0;
  const reassessmentAttempts = attempts.filter((attempt) => attempt.phase === 'reassessment');
  const lastReassessment =
    reassessmentAttempts.length > 0
      ? reassessmentAttempts[reassessmentAttempts.length - 1]
      : null;

  const submitAnswer = (phase: 'practice' | 'reassessment'): void => {
    const question = phase === 'practice' ? activeQuestion : reassessmentQuestion;
    const value = phase === 'practice' ? answer : reassessmentAnswer;
    if (!question) return;
    if (value.trim().length === 0) {
      setLocalError('Type your answer before submitting.');
      return;
    }
    setLocalError(null);
    try {
      const check = checkAnswer(question, value, topicContext.notes);
      const attempt = makeAttempt({
        question,
        phase,
        answer: value,
        check,
        submittedAt: new Date().toISOString(),
      });
      const result = actions.addAttempt(submission.id, attempt);
      if (!result) {
        setLocalError('This submission no longer exists — the attempt was not recorded.');
        return;
      }
      if (result.duplicate) {
        setDuplicate(
          'This exact answer is already recorded for this question — edit it or move to the next question.'
        );
        return;
      }
      setDuplicate(null);
      if (phase === 'practice') {
        setAnswer('');
      } else {
        // Keep the panel open so the student sees the reassessment outcome.
        setReassessmentAnswer('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not record the attempt.';
      setLocalError(message);
    }
  };

  return (
    <Card elevation={1} padding="md" data-testid="practice-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <HelpCircle className="h-5 w-5 text-teal-600" aria-hidden="true" />
            Practise this topic
          </h2>
          <p className="text-sm text-ink-muted">
            Generated from your topic, notes and recorded evidence — an automatic coverage check,
            not a teacher's marking.
          </p>
        </div>
        <Badge variant="default" size="sm" data-testid="practice-progress">
          {passedCount} passed · {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {localError && (
        <p className="mb-3 text-sm text-coral-600" role="alert" data-testid="practice-error">
          {localError}
        </p>
      )}
      {duplicate && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status" data-testid="practice-duplicate">
          {duplicate}
        </p>
      )}

      {activeQuestion ? (
        <div className="mb-4 rounded-xl border border-border bg-gray-50 p-4" data-testid="practice-question">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="info" size="sm">
              {activeQuestion.kind}
            </Badge>
            <Badge variant="default" size="sm">
              {activeQuestion.difficulty}
            </Badge>
            <Badge variant="default" size="sm">
              generated · not syllabus-verified
            </Badge>
          </div>
          <p className="mb-1 text-base font-semibold text-ink" data-testid="practice-question-prompt">
            {activeQuestion.prompt}
          </p>
          <p className="mb-3 text-sm text-ink-muted">{activeQuestion.instructions}</p>
          <Textarea
            label="Your answer"
            data-testid="practice-answer"
            rows={4}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Explain in your own words…"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => submitAnswer('practice')}
              data-testid="practice-submit"
            >
              Submit answer
            </Button>
            <span className="text-xs text-ink-subtle">
              Checked automatically against your own notes.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 p-4" data-testid="practice-all-passed">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700">
            <Award className="h-4 w-4" aria-hidden="true" />
            Every unlocked practice question has a passing attempt — take the reassessment to
            re-check from memory.
          </p>
        </div>
      )}

      {questions.filter((question) => question.locked).length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-muted" data-testid="practice-locked-stretch">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          A stretch question unlocks after your first passing attempt.
        </p>
      )}

      {reassessmentEnabled && (
        <div className="mb-4">
          {!showReassessment ? (
            <Button
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => setShowReassessment(true)}
              data-testid="practice-reassessment-cta"
            >
              Take a reassessment check
            </Button>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4" data-testid="practice-reassessment">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="info" size="sm">
                  reassessment
                </Badge>
                <Badge variant="default" size="sm">
                  generated · not syllabus-verified
                </Badge>
              </div>
              <p className="mb-1 text-base font-semibold text-ink" data-testid="reassessment-prompt">
                {reassessmentQuestion.prompt}
              </p>
              <p className="mb-3 text-sm text-ink-muted">{reassessmentQuestion.instructions}</p>
              <Textarea
                label="Your reassessment answer"
                data-testid="reassessment-answer"
                rows={4}
                value={reassessmentAnswer}
                onChange={(event) => setReassessmentAnswer(event.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => submitAnswer('reassessment')}
                  data-testid="reassessment-submit"
                >
                  Submit reassessment
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowReassessment(false)}>
                  Not now
                </Button>
              </div>
              {lastReassessment && lastReassessment.questionId === reassessmentQuestion.id && (
                <div className="mt-3 rounded-lg border border-border bg-white p-3">
                  <CheckResultView check={lastReassessment.check as AnswerCheck} phase="reassessment" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {latestAttempt && latestAttempt.phase === 'practice' && latestAttempt.check && (
        <div className="mb-4 rounded-xl border border-border bg-white p-3" data-testid="latest-check">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Latest practice check
          </p>
          <CheckResultView check={latestAttempt.check} phase="practice" />
        </div>
      )}

      {attempts.length === 0 ? (
        <p className="text-sm text-ink-muted" data-testid="practice-empty">
          No answers submitted yet — your attempts and their automatic checks will be listed here.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="practice-attempts">
          {[...attempts].reverse().map((attempt) => (
            <AttemptRow key={attempt.id} attempt={attempt} />
          ))}
        </ul>
      )}

      {attempts.length > 0 && latestAttempt && !latestAttempt.check?.passed && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Practice attempts change what the Learning Insights page reports — evidence appears once
          an answer is checked.
        </p>
      )}
    </Card>
  );
}
