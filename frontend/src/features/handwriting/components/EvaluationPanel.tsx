// Evaluation panel — confirm the input, run the deterministic evaluator and
// present its six possible outcomes with a strict observed/inferred split.
//
// Honesty rules enforced here:
// - evaluation only reads `submission.confirmedText` (student-confirmed);
// - every outcome renders with its confidence and caveat — uncertain results
//   are never dressed up as diagnoses;
// - "observed" (facts from the records) and "inferred" (classified
//   conclusions) are shown as separate, labelled groups;
// - when the confirmed text changed AFTER an evaluation ran, the result is
//   marked stale and must be re-run before it can be trusted.

import { useEffect, useState } from 'react';
import { CircleAlert, ClipboardCheck, Eye, Lightbulb, PencilLine, Sparkles } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input, Textarea } from '../../../components/ui/Input';
import { useHandwritingActions } from '../../../hooks/useHandwriting';
import { evaluateSubmission, EVALUATION_OUTCOME_LABEL } from '../evaluation';
import { isEvaluationStale } from '../progressModel';
import type { EvaluationOutcome, EvaluationResult, HandwritingSubmission } from '../handwritingTypes';
import type { EvidenceConfidence } from '../../../types/gurugraph';

const OUTCOME_VARIANT: Record<EvaluationOutcome, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  confirmed_error: 'danger',
  plausible_gap: 'warning',
  insufficient_evidence: 'default',
  extraction_failure: 'danger',
  evaluation_unavailable: 'info',
  no_gap: 'success',
};

const CONFIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  none: 'no confidence',
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

/** Props for the deterministic evaluation panel. */
export interface EvaluationPanelProps {
  submission: HandwritingSubmission;
  /** Topic notes/title the completeness check derives key ideas from. */
  topicContext: { title: string; notes: string };
  /** Back to the extraction review to correct the text. */
  onReviewText: () => void;
  /** Reveal the practice section after evaluating. */
  onOpenPractice: () => void;
}

export function EvaluationPanel({
  submission,
  topicContext,
  onReviewText,
  onOpenPractice,
}: EvaluationPanelProps) {
  const actions = useHandwritingActions();
  const [question, setQuestion] = useState(submission.question);
  const [referenceAnswer, setReferenceAnswer] = useState(submission.referenceAnswer);
  const [evaluating, setEvaluating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setQuestion(submission.question);
    setReferenceAnswer(submission.referenceAnswer);
  }, [submission.id, submission.question, submission.referenceAnswer]);

  const evaluation = submission.evaluation;
  const stale = isEvaluationStale(submission);

  const persistInputs = (next: { question?: string; referenceAnswer?: string }): void => {
    actions.updateSubmission(submission.id, (current) => ({
      ...current,
      question: next.question ?? current.question,
      referenceAnswer: next.referenceAnswer ?? current.referenceAnswer,
    }));
  };

  const handleEvaluate = (): void => {
    setEvaluating(true);
    setLocalError(null);
    try {
      persistInputs({ question, referenceAnswer });
      const result: EvaluationResult = evaluateSubmission({
        pages: submission.pages,
        confirmedText: submission.confirmedText,
        topic: topicContext,
        referenceAnswer,
      });
      actions.saveEvaluation(submission.id, result);
      onOpenPractice();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evaluation could not be run.';
      setLocalError(message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <Card elevation={1} padding="md" data-testid="evaluation-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ClipboardCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />
            Evaluate
          </h2>
          <p className="text-sm text-ink-muted">
            A deterministic check of your confirmed text — six possible results, each with its
            evidence. No AI judges this.
          </p>
        </div>
        <Badge size="sm" variant={submission.evidenceQuality === 'manual' ? 'default' : 'info'}>
          text: {submission.evidenceQuality === 'ocr_corrected' ? 'corrected extraction' : submission.evidenceQuality === 'ocr_confirmed' ? 'confirmed extraction' : 'manual transcription'}
        </Badge>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-gray-50 p-3" data-testid="confirmed-summary">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Confirmed text being evaluated
          </span>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<PencilLine className="h-3.5 w-3.5" />}
            onClick={onReviewText}
            data-testid="review-text-link"
          >
            Correct the text
          </Button>
        </div>
        <pre
          className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-xs text-ink"
          data-testid="confirmed-text-summary"
        >
          {submission.confirmedText.trim() || '(empty)'}
        </pre>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input
          label="What does this work answer?"
          data-testid="evaluation-question"
          value={question}
          placeholder="e.g. Exercise 4 — solve 2x + 5 = 17"
          onChange={(event) => setQuestion(event.target.value)}
          onBlur={() => persistInputs({ question })}
        />
        <div className="sm:col-span-1">
          <Textarea
            label="Reference answer (optional)"
            data-testid="evaluation-reference"
            rows={2}
            value={referenceAnswer}
            placeholder="e.g. x = 6"
            onChange={(event) => setReferenceAnswer(event.target.value)}
            onBlur={() => persistInputs({ referenceAnswer })}
            hint={
              submission.referenceAnswer.trim()
                ? 'Comparison basis: your reference answer.'
                : 'With a reference you get a definitive match/mismatch. Without one, evaluation checks completeness against your topic notes.'
            }
          />
        </div>
      </div>

      {localError && (
        <p className="mb-3 text-sm text-coral-600" role="alert" data-testid="evaluation-error">
          {localError}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          loading={evaluating}
          leftIcon={<Sparkles className="h-4 w-4" />}
          onClick={handleEvaluate}
          data-testid="evaluate-button"
        >
          {evaluation ? 'Evaluate again' : 'Evaluate this work'}
        </Button>
        <span className="text-xs text-ink-subtle">
          Runs on this device from your confirmed text and notes.
        </span>
      </div>

      {evaluation && (
        <div className="space-y-4" data-testid="evaluation-result">
          {stale && (
            <div
              role="alert"
              data-testid="evaluation-stale"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                The confirmed text changed after this evaluation ran — the result below describes an
                earlier version. Press <strong>Evaluate again</strong>.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={OUTCOME_VARIANT[evaluation.outcome]} data-testid="evaluation-outcome">
              {EVALUATION_OUTCOME_LABEL[evaluation.outcome]}
            </Badge>
            <Badge variant="default" size="sm" data-testid="evaluation-confidence">
              {CONFIDENCE_LABEL[evaluation.confidence]}
            </Badge>
            {evaluation.referenceUsed && (
              <Badge variant="info" size="sm">
                reference compared
              </Badge>
            )}
          </div>

          <p className="text-base font-semibold text-ink" data-testid="evaluation-headline">
            {evaluation.headline}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3" data-testid="evaluation-observed">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Observed in your records
              </p>
              <ul className="space-y-1.5">
                {evaluation.observed.map((item) => (
                  <li key={item} className="text-sm text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3" data-testid="evaluation-inferred">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                Inferred / classified
              </p>
              <ul className="space-y-1.5">
                {evaluation.inferred.map((item) => (
                  <li key={item} className="text-sm text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {evaluation.missingConcepts.length > 0 && (
            <div data-testid="evaluation-missing">
              <p className="mb-1.5 text-sm font-semibold text-ink">Key ideas not found in your answer</p>
              <div className="flex flex-wrap gap-1.5">
                {evaluation.missingConcepts.map((concept) => (
                  <Badge key={concept} variant="warning" size="sm">
                    {concept}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm italic text-ink-muted" data-testid="evaluation-caveat">
            {evaluation.caveat}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={onOpenPractice}
              data-testid="evaluation-practice-cta"
            >
              Practise this topic
            </Button>
            <Button variant="outline" onClick={onReviewText}>
              Correct the text and re-evaluate
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
