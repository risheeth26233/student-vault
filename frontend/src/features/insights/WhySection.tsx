// Learning Insights — expandable "Why?" section.
//
// Shared by the mastery and gap cards. It deliberately splits a conclusion
// into two labelled halves so the student can always tell what was OBSERVED in
// their own records apart from what the intelligence layer INFERRED or
// CLASSIFIED from those records.

import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface WhySectionProps {
  /** Unique base id — used to wire aria-controls/for and test ids. */
  id: string;
  /** Heading for the inferred/classified half. */
  conclusionTitle: string;
  conclusion: React.ReactNode;
  /** Heading for the observed-evidence half. */
  evidenceTitle: string;
  evidence: React.ReactNode;
  /** Honest framing note (a rule id / disclaimer) shown under the halves. */
  footerNote?: string;
}

export function WhySection({
  id,
  conclusionTitle,
  conclusion,
  evidenceTitle,
  evidence,
  footerNote,
}: WhySectionProps) {
  const [open, setOpen] = useState(false);
  const panelId = `${id}-why-panel`;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800"
        data-testid={`${id}-why-toggle`}
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
        Why?
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={panelId} className="mt-3 space-y-4" data-testid={`${id}-why-panel`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {conclusionTitle}
            </p>
            <div className="mt-1.5">{conclusion}</div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {evidenceTitle}
            </p>
            <div className="mt-1.5">{evidence}</div>
          </div>
          {footerNote && <p className="text-xs italic text-ink-muted">{footerNote}</p>}
        </div>
      )}
    </div>
  );
}
