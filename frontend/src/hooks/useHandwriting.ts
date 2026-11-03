// Handwritten work & practice hooks (Phase 3).
//
// Read queries expose submissions and the slim evidence list (consumed by the
// GuruGraph integration hook); actions are thin wrappers over the local-first
// store that invalidate both query keys after every mutation.

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAttempt,
  addSubmissionPages,
  confirmSubmissionText,
  createSubmission,
  deleteSubmission,
  loadSubmissions,
  removeSubmissionPage,
  saveEvaluation,
  updateSubmission,
  type AddAttemptResult,
} from '../services/handwritingStore';
import { buildHandwritingEvidence } from '../features/handwriting/handwritingEvidence';
import type {
  EvaluationResult,
  HandwritingEvidence,
  HandwritingSubmission,
  PracticeAttempt,
} from '../features/handwriting/handwritingTypes';

/** Query key prefix shared by every handwritten-work query. */
export const handwritingKey = ['handwriting'] as const;

export function useHandwritingSubmissions() {
  return useQuery({
    queryKey: [...handwritingKey, 'submissions'],
    queryFn: () => loadSubmissions(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Phase 3 evidence for GuruGraph signal ingestion — no text, no images,
 * outcomes only. Read-only with respect to every Student-Vault store.
 */
export function useHandwritingEvidence() {
  return useQuery({
    queryKey: [...handwritingKey, 'evidence'],
    queryFn: (): HandwritingEvidence[] => buildHandwritingEvidence(loadSubmissions()),
    staleTime: 1000 * 60 * 2,
  });
}

export interface HandwritingActions {
  createSubmission: typeof createSubmission;
  updateSubmission: typeof updateSubmission;
  addPages: typeof addSubmissionPages;
  removePage: typeof removeSubmissionPage;
  deleteSubmission: typeof deleteSubmission;
  confirmText: typeof confirmSubmissionText;
  saveEvaluation: (id: string, evaluation: EvaluationResult) => HandwritingSubmission | null;
  addAttempt: (id: string, attempt: PracticeAttempt) => AddAttemptResult | null;
}

export function useHandwritingActions(): HandwritingActions {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const invalidate = (): void => {
      queryClient.invalidateQueries({ queryKey: handwritingKey });
    };

    return {
      createSubmission: (input, now) => {
        const created = createSubmission(input, now);
        invalidate();
        return created;
      },
      updateSubmission: (id, updater, now) => {
        const updated = updateSubmission(id, updater, now);
        invalidate();
        return updated;
      },
      addPages: (id, pages, now) => {
        const updated = addSubmissionPages(id, pages, now);
        invalidate();
        return updated;
      },
      removePage: async (id, resourceId, now) => {
        const updated = await removeSubmissionPage(id, resourceId, now);
        invalidate();
        return updated;
      },
      deleteSubmission: async (id) => {
        const removed = await deleteSubmission(id);
        invalidate();
        return removed;
      },
      confirmText: (id, input, now) => {
        const updated = confirmSubmissionText(id, input, now);
        invalidate();
        return updated;
      },
      saveEvaluation: (id, evaluation) => {
        const updated = saveEvaluation(id, evaluation);
        invalidate();
        return updated;
      },
      addAttempt: (id, attempt) => {
        const result = addAttempt(id, attempt);
        invalidate();
        return result;
      },
    };
  }, [queryClient]);
}
