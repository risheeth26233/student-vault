import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, CalendarDays, Lightbulb, NotebookPen, PenLine } from 'lucide-react';

const StudyGradient = lazy(() => import('./StudyGradient'));

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Decoration stays independent of the student tools and account controls. */
export function StudyAtmosphere() {
  const container = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const pointerFrame = useRef(0);

  useEffect(() => {
    if (!window.matchMedia || !window.IntersectionObserver) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    const update = () => setEnabled(inView && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    if (container.current) observer.observe(container.current);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    const root = container.current;
    if (typeof window.matchMedia !== 'function') return;
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!root || !pointer.matches) return;
    const move = (event: PointerEvent) => {
      if (pointerFrame.current) return;
      pointerFrame.current = requestAnimationFrame(() => {
        pointerFrame.current = 0;
        const rect = root.getBoundingClientRect();
        root.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        root.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    };
    const leave = () => {
      root.style.setProperty('--mx', '55%');
      root.style.setProperty('--my', '40%');
    };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    return () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(pointerFrame.current);
    };
  }, []);

  return <div ref={container} className="sv-atmosphere" data-paused={paused}>
    <div className="sv-atmosphere-art" aria-hidden="true">
      {enabled && !paused && <VisualBoundary><Suspense fallback={null}><StudyGradient /></Suspense></VisualBoundary>}
    </div>
    <div className="sv-product-preview" aria-hidden="true">
      <div className="sv-preview-rail"><span>SV</span><span><BookOpen size={15} /></span><span><NotebookPen size={15} /></span><span><CalendarDays size={15} /></span><span><Lightbulb size={15} /></span><span><PenLine size={15} /></span></div>
      <div className="sv-preview-main">
        <div className="sv-preview-topline"><strong>STUDENT VALUT</strong><span>MY STUDY SPACE&nbsp; · &nbsp;PREVIEW</span></div>
        <div className="sv-preview-intro"><small>Your next study session</small><h2>Make space to understand.</h2><p>Topics, notes and useful next steps — together.</p></div>
        <div className="sv-preview-story" aria-hidden="true"><span className="sv-story-scene">Sort notes and resources</span><span className="sv-story-scene">Understand recorded signals</span><span className="sv-story-scene">Choose a practice step</span><span className="sv-story-scene">Check the reassessment</span></div>
        <div className="sv-preview-panels">
          <div className="sv-preview-card"><small>IN YOUR VAULT</small><div className="sv-preview-topic">Biology · Cells</div><span className="sv-preview-pill">Review suggested</span></div>
          <div className="sv-preview-card"><small>LEARNING SIGNAL</small><div className="sv-preview-progress"><span /></div><div className="sv-preview-foot"><span>Recorded evidence</span><strong>View insight →</strong></div></div>
        </div>
        <div className="sv-preview-foot"><span>NOTES&nbsp; · &nbsp;ATTENDANCE&nbsp; · &nbsp;PRACTICE</span><strong>Continue where you left off ↗</strong></div>
      </div>
    </div>
    {enabled && <button type="button" className="sv-motion-toggle" aria-pressed={paused}
      onClick={() => setPaused(value => !value)}>{paused ? 'Play animation' : 'Pause animation'}</button>}
    <span className="sv-preview-cue" aria-hidden="true">Product preview · illustrative</span>
  </div>;
}
