// Handwritten work & practice — the Phase 3 workflow page.
//
// Flow: pick a topic → upload page images → extract (with consent) or
// transcribe manually → confirm the text → deterministic evaluation →
// adaptive practice → reassessment → progress, all feeding the existing
// GuruGraph intelligence read-only. Every state is honest: a failed or
// unavailable provider is surfaced, never faked, and nothing the student
// recorded is ever discarded silently.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, PenLine, Plus, Trash2 } from 'lucide-react';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useAllTopics } from '../hooks/useTopics';
import { useHandwritingSubmissions, useHandwritingActions } from '../hooks/useHandwriting';
import { useGuruGraphIntelligence } from '../gurugraph';
import { handwritingApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { SubmissionComposer } from '../features/handwriting/components/SubmissionComposer';
import { ExtractionReview, isExtractionPhase } from '../features/handwriting/components/ExtractionReview';
import { EvaluationPanel } from '../features/handwriting/components/EvaluationPanel';
import { PracticePanel } from '../features/handwriting/components/PracticePanel';
import { ProgressPanel } from '../features/handwriting/components/ProgressPanel';
import type { PracticeTopicContext, TopicIntelligenceContext } from '../features/handwriting/practiceEngine';
import type { HandwritingSubmission } from '../features/handwriting/handwritingTypes';

const STATUS_LABEL: Record<HandwritingSubmission['status'], string> = {
  draft: 'pages added',
  extracting: 'extracting…',
  extracted: 'text extracted',
  provider_unavailable: 'manual transcription',
  extraction_failed: 'extraction failed',
  confirmed: 'text confirmed',
  evaluated: 'evaluated',
};

function statusVariant(
  status: HandwritingSubmission['status']
): 'default' | 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'evaluated') return 'success';
  if (status === 'confirmed') return 'info';
  if (status === 'extraction_failed') return 'danger';
  if (status === 'provider_unavailable' || status === 'extracting') return 'warning';
  return 'default';
}

function sortByRecency(submissions: readonly HandwritingSubmission[]): HandwritingSubmission[] {
  return [...submissions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function HandwritingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const topicParam = searchParams.get('topic');

  const topicsQuery = useAllTopics();
  const submissionsQuery = useHandwritingSubmissions();
  const actions = useHandwritingActions();
  const guru = useGuruGraphIntelligence();

  const ocrStatusQuery = useQuery({
    queryKey: ['handwriting', 'ocr-status'],
    queryFn: () => handwritingApi.status(),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const topics = topicsQuery.data?.topics ?? [];
  // Stable identity: `?? []` would otherwise create a new array every render
  // and re-run the deep-link effect below on each one.
  const submissions = useMemo(() => submissionsQuery.data ?? [], [submissionsQuery.data]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [creationToken, setCreationToken] = useState(0);
  const [pageError, setPageError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const practiceRef = useRef<HTMLDivElement>(null);
  const handledTopicParam = useRef<string | null>(null);

  // Deep link: ?topic=<id> opens that topic's latest submission if one exists,
  // otherwise the composer with the topic preselected. Waits for the records
  // to load before marking the link handled, and never re-opens over an
  // explicit "back to list" choice.
  useEffect(() => {
    if (!topicParam || handledTopicParam.current === topicParam) return;
    if (submissionsQuery.isLoading) return;
    handledTopicParam.current = topicParam;
    const forTopic = sortByRecency(submissions.filter((s) => s.topicId === topicParam));
    if (forTopic.length > 0) setActiveId(forTopic[0].id);
  }, [topicParam, submissions, submissionsQuery.isLoading]);

  const active = useMemo(
    () => submissions.find((submission) => submission.id === activeId) ?? null,
    [submissions, activeId]
  );
  const activeTopic = active ? topics.find((topic) => topic.id === active.topicId) ?? null : null;

  const topicContext: PracticeTopicContext | null = active
    ? {
        id: active.topicId,
        title: activeTopic?.title ?? active.topicTitle,
        subject: activeTopic?.subject ?? active.subject,
        notes: activeTopic?.notes ?? '',
      }
    : null;

  // Read-only slice of Phase 2 intelligence for the active topic — practice
  // prioritisation consumes this, never mutates it.
  const topicIntelligence: TopicIntelligenceContext | null = useMemo(() => {
    if (!active || guru.isLoading || !guru.snapshot) return null;
    const intelligence = guru.service.getTopicIntelligence(active.topicId);
    if (!intelligence) return null;
    const mastery = intelligence.mastery.find(
      (record) => record.scope === 'topic' && record.topicId === active.topicId
    );
    return {
      masteryLevel: mastery?.level ?? 'insufficient_evidence',
      gaps: intelligence.gaps
        .filter((gap) => gap.topicId === active.topicId)
        .map((gap) => ({ category: gap.category, reason: gap.reason })),
    };
  }, [active, guru.isLoading, guru.snapshot, guru.service]);

  const ocrConfigured = ocrStatusQuery.data ? ocrStatusQuery.data.configured : null;
  const ocrProvider = ocrStatusQuery.data?.provider ?? null;

  const reopenExtraction = (): void => {
    if (!active) return;
    actions.updateSubmission(active.id, (submission) => ({
      ...submission,
      status: submission.pages.some(
        (page) => page.extraction.status === 'ok' || page.extraction.status === 'low_confidence'
      )
        ? 'extracted'
        : 'provider_unavailable',
    }));
  };

  const scrollToPractice = (): void => {
    if (practiceRef.current && typeof practiceRef.current.scrollIntoView === 'function') {
      practiceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const startNew = (): void => {
    setActiveId(null);
    setCreationToken((token) => token + 1);
  };

  const activeIntelligence = activeTopic && active
    ? guru.service.getTopicIntelligence(active.topicId)
    : null;

  const header = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <PenLine className="h-5 w-5 text-teal-600" aria-hidden="true" />
      <span className="text-sm font-medium text-teal-700">Phase 3 · adaptive practice loop</span>
    </div>
  );

  return (
    <PageContainer header={header}>
      <ContentWrapper>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Handwritten work &amp; practice</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Photograph completed work, review the extracted text, get a deterministic evaluation
              with its evidence, then practise and reassess. Everything is stored on this device and
              feeds Learning Insights as extra evidence — never as a diagnosis.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/insights" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Learning Insights
            </Link>
            <span className="text-ink-subtle" aria-hidden="true">·</span>
            <Link to="/vault" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Topics
            </Link>
            {active && (
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={startNew} data-testid="new-submission">
                New submission
              </Button>
            )}
          </div>
        </div>

        {pageError && (
          <p className="mb-4 text-sm text-coral-600" role="alert" data-testid="handwriting-page-error">
            {pageError}
          </p>
        )}

        {topicsQuery.isLoading || submissionsQuery.isLoading ? (
          <div className="space-y-4" data-testid="handwriting-loading">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {topics.length === 0 && !active ? (
              <EmptyState
                illustration="topics"
                title="Add a topic first"
                description="Handwritten submissions are attached to a topic so its evidence, notes and practice all stay together."
                action={
                  <Button variant="primary" onClick={() => navigate('/vault')}>
                    Go to My Vault
                  </Button>
                }
              />
            ) : (
              <SubmissionComposer
                topics={topics}
                submission={active}
                initialTopicId={topicParam}
                creationToken={creationToken}
                onCreated={(submission) => setActiveId(submission.id)}
                onError={setPageError}
              />
            )}

            {active && topicContext ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2" data-testid="active-toolbar">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<ArrowLeft className="h-4 w-4" />}
                      onClick={() => setActiveId(null)}
                      data-testid="back-to-list"
                    >
                      All submissions
                    </Button>
                    <Badge variant={statusVariant(active.status)} size="sm" data-testid="active-status">
                      {STATUS_LABEL[active.status]}
                    </Badge>
                    {active.evidenceQuality && (
                      <Badge variant="default" size="sm">
                        {active.evidenceQuality === 'ocr_corrected'
                          ? 'text corrected'
                          : active.evidenceQuality === 'ocr_confirmed'
                            ? 'text confirmed as read'
                            : 'manual transcription'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {confirmingDelete ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            void actions.deleteSubmission(active.id).then(() => {
                              setActiveId(null);
                              setConfirmingDelete(false);
                            });
                          }}
                          data-testid="confirm-delete"
                        >
                          Delete this work
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                          Keep it
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setConfirmingDelete(true)}
                        data-testid="delete-submission"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                <Card elevation={0} padding="sm" data-testid="guru-context">
                  <p className="flex items-center gap-2 text-sm text-ink-muted">
                    <Lightbulb className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                    {guru.isLoading
                      ? 'Loading what Learning Insights already knows about this topic…'
                      : activeIntelligence
                        ? `Practice below is prioritised from this topic's existing Learning Insights evidence (${activeIntelligence.mastery.filter((record) => record.scope === 'topic').map((record) => record.level).join(', ') || 'insufficient evidence'} · ${activeIntelligence.gaps.length} candidate gap${activeIntelligence.gaps.length === 1 ? '' : 's'}). Read-only — the intelligence layer is never changed by this page.`
                        : 'No Learning Insights evidence for this topic yet — practice below starts from your notes.'}
                  </p>
                </Card>

                {isExtractionPhase(active.status) ? (
                  <ExtractionReview
                    submission={active}
                    ocrConfigured={ocrConfigured}
                    ocrProvider={ocrProvider}
                  />
                ) : (
                  <>
                    <EvaluationPanel
                      submission={active}
                      topicContext={{ title: topicContext.title, notes: topicContext.notes }}
                      onReviewText={reopenExtraction}
                      onOpenPractice={scrollToPractice}
                    />
                    <div ref={practiceRef}>
                      <PracticePanel
                        submission={active}
                        topicContext={topicContext}
                        topicIntelligence={topicIntelligence}
                      />
                    </div>
                  </>
                )}

                <ProgressPanel submission={active} />
              </>
            ) : (
              <Card elevation={1} padding="md" data-testid="submission-history">
                <h2 className="mb-1 text-lg font-semibold text-ink">Your submissions</h2>
                <p className="mb-4 text-sm text-ink-muted">
                  Each submission keeps its pages, extracted text, evaluation, practice attempts and
                  progress together — stored on this device only.
                </p>
                {submissions.length === 0 ? (
                  <EmptyState
                    size="sm"
                    illustration="resources"
                    title="No handwritten work yet"
                    description="Pick a topic above and add photos of your completed work to start the loop."
                  />
                ) : (
                  <ul className="divide-y divide-border" data-testid="submission-list">
                    {sortByRecency(submissions).map((submission) => (
                      <li
                        key={submission.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                        data-testid={`submission-item-${submission.id}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {submission.topicTitle}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="info" size="sm">
                              {submission.subject}
                            </Badge>
                            <Badge variant={statusVariant(submission.status)} size="sm">
                              {STATUS_LABEL[submission.status]}
                            </Badge>
                            <span className="text-xs text-ink-subtle">
                              {submission.pages.length} page{submission.pages.length === 1 ? '' : 's'} ·{' '}
                              {submission.attempts.length} attempt
                              {submission.attempts.length === 1 ? '' : 's'} ·{' '}
                              {new Date(submission.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveId(submission.id)}
                          data-testid={`open-${submission.id}`}
                        >
                          Open
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        )}
      </ContentWrapper>
    </PageContainer>
  );
}
