// Practice evidence section (Phase 3 → Learning Insights).
//
// Renders the handwritten-practice loop (submission → evaluation → practice →
// reassessment) as honest evidence cards. Hidden entirely when there is
// nothing to show — Learning Insights stays a read-only, gap-free page for
// students who never use this workflow.

import { PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useHandwritingSubmissions } from '../../hooks/useHandwriting';
import { summarizeProgress } from '../handwriting/progressModel';
import { EVALUATION_OUTCOME_LABEL } from '../handwriting/evaluation';
import type { HandwritingSubmission } from '../handwriting/handwritingTypes';

function hasEvidence(submission: HandwritingSubmission): boolean {
  return submission.evaluation !== null || submission.attempts.length > 0;
}

function EvidenceCard({ submission }: { submission: HandwritingSubmission }) {
  const summary = summarizeProgress(submission);
  const attempts = submission.attempts;
  const passed = attempts.filter((attempt) => attempt.check?.passed).length;
  const reassessments = attempts.filter((attempt) => attempt.phase === 'reassessment').length;

  return (
    <Card elevation={0} padding="md" data-testid={`practice-evidence-${submission.id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="info" size="sm">
          {submission.subject}
        </Badge>
        <span className="text-sm font-semibold text-ink">{submission.topicTitle}</span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        {submission.evaluation && (
          <Badge
            variant={
              submission.evaluation.outcome === 'no_gap'
                ? 'success'
                : submission.evaluation.outcome === 'confirmed_error'
                  ? 'danger'
                  : 'warning'
            }
            size="sm"
          >
            {EVALUATION_OUTCOME_LABEL[submission.evaluation.outcome]}
          </Badge>
        )}
        <Badge variant="default" size="sm">
          {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
        </Badge>
        <Badge variant="default" size="sm">
          {passed} passed
        </Badge>
        {reassessments > 0 && (
          <Badge variant="default" size="sm">
            {reassessments} reassessment{reassessments === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      {summary && (
        <p className="text-sm text-ink-muted" data-testid={`practice-progress-${submission.id}`}>
          {summary.statement}
        </p>
      )}
    </Card>
  );
}

export function PracticeEvidenceSection() {
  const submissionsQuery = useHandwritingSubmissions();
  const submissions = (submissionsQuery.data ?? []).filter(hasEvidence);

  // Progressive enhancement: the section stays silent until records are ready,
  // so Learning Insights works with or without this data (and with or without
  // router context in isolated renders).
  if (submissionsQuery.isPending) return null;

  if (submissionsQuery.isError) {
    return (
      <section className="mb-8" aria-labelledby="practice-evidence-heading" data-testid="practice-evidence-section">
        <h2 id="practice-evidence-heading" className="mb-4 text-base font-semibold text-ink">
          Handwritten practice evidence
        </h2>
        <p className="text-sm text-coral-600" role="alert" data-testid="practice-evidence-error">
          Practice records could not be read from this device — the estimates above are unaffected.
        </p>
      </section>
    );
  }

  if (submissions.length === 0) return null;

  return (
    <SectionShell>
      <div className="grid gap-4 sm:grid-cols-2">
        {submissions.map((submission) => (
          <EvidenceCard key={submission.id} submission={submission} />
        ))}
      </div>
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-8" aria-labelledby="practice-evidence-heading" data-testid="practice-evidence-section">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-evidence-heading" className="text-base font-semibold text-ink">
          Handwritten practice evidence
        </h2>
        <Link
          to="/handwriting"
          className="flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Open handwritten practice
        </Link>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        Submitted work, automatic checks and reassessments recorded on this device. These outcomes
        feed the mastery estimates above as additional evidence — never as a diagnosis.
      </p>
      {children}
    </section>
  );
}
