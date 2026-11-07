import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

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

  return <div ref={container} className="sv-atmosphere">
    <div className="sv-atmosphere-art" aria-hidden="true">
      {enabled && !paused && <VisualBoundary><Suspense fallback={null}><StudyGradient /></Suspense></VisualBoundary>}
    </div>
    <div className="sv-atmosphere-caption">
      <span className="sv-orbit-mark" aria-hidden="true">✳</span>
      <p>A little curiosity.<br /><strong>A world of possibility.</strong></p>
      <span className="sv-atmosphere-tag">Your next chapter starts here</span>
    </div>
    {enabled && <button type="button" className="sv-motion-toggle" aria-pressed={paused}
      onClick={() => setPaused(value => !value)}>{paused ? 'Play animation' : 'Pause animation'}</button>}
  </div>;
}
