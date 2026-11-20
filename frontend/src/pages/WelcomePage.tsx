import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, BookOpen, CalendarCheck, ClipboardCheck, FileText,
  Lightbulb, NotebookPen, PenLine, Sparkles, Users, Video,
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { StudyAtmosphere } from '../components/StudyAtmosphere';
import '../styles/welcome.css';

const features = [
  { icon: NotebookPen, title: 'Notes that stay connected', detail: 'Organize ideas by subject and topic, then keep useful resources close.', path: '/notes', tag: 'STUDY SPACE' },
  { icon: CalendarCheck, title: 'Attendance calculator & deadlines', detail: 'Track attendance and upcoming assignments in one place.', path: '/attendance', tag: 'EVERYDAY' },
  { icon: Video, title: 'Another way to learn it', detail: 'Find video references from a topic or the question you are working through.', path: '/youtube', tag: 'RESOURCES' },
  { icon: Sparkles, title: 'A personal study companion', detail: 'Ask for patient explanations and grounded help with your study materials.', path: '/ai', tag: 'STUDY SUPPORT' },
  { icon: Lightbulb, title: 'Learning signals, explained', detail: 'GuruGraph summarizes recorded evidence and shows when there is not enough to conclude.', path: '/insights', tag: 'GURUGRAPH' },
  { icon: PenLine, title: 'Practice from your work', detail: 'Review handwritten work, try adaptive questions, and track reassessment evidence.', path: '/handwriting', tag: 'PRACTICE' },
  { icon: Users, title: 'A follow-up with a teacher', detail: 'Share a class code and work through a teacher-proposed learning plan.', path: '/teacher', tag: 'TEACHER LOOP' },
  { icon: ClipboardCheck, title: 'Keep deadlines visible', detail: 'Capture assignments and return to what needs attention next.', path: '/assignments', tag: 'ORGANIZE' },
];

const steps = ['Record a topic or result', 'See what the evidence says', 'Choose a useful next step', 'Practice and reassess'];

export function WelcomePage() {
  const { user, profile, isLoading, signIn, signUp, authError, setProfile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const brandRef = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!media.matches) return;
    const update = () => {
      frame.current = 0;
      const brand = brandRef.current;
      if (!brand || !pointer.current) return;
      const rect = brand.getBoundingClientRect();
      const dx = Math.max(rect.left - pointer.current.x, 0, pointer.current.x - rect.right);
      const dy = Math.max(rect.top - pointer.current.y, 0, pointer.current.y - rect.bottom);
      brand.style.setProperty('--brand-near', String(Math.max(0, 1 - Math.hypot(dx, dy) / 150)));
    };
    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    const onLeave = () => brandRef.current?.style.setProperty('--brand-near', '0');
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  if (user && !isLoading) return <Navigate to="/dashboard" replace />;

  function openWorkspace(path = '/dashboard') {
    if (!profile?.guest) setProfile({ name: 'Guest', guest: true });
    navigate(path);
  }

  async function openAccount(create: boolean) {
    setError('');
    try {
      await (create ? signUp() : signIn());
    } catch {
      setError('Account access is unavailable right now. You can still use the guest workspace.');
    }
  }

  return (
    <main id="top" className="sv-welcome min-h-screen bg-canvas text-ink">
      <div className="sv-welcome-frame mx-auto max-w-7xl px-5 sm:px-8">
        <header className="sv-welcome-nav">
          <a ref={brandRef} href="#top" className="sv-brand" aria-label="Student-Valut home">
            <span className="brand-mark"><BookOpen className="h-5 w-5" aria-hidden="true" /></span>
            <span>STUDENT <b>VALUT</b></span>
          </a>
          <nav className="sv-public-nav" aria-label="Main navigation">
            <a href="#features">What you can do</a>
            <a href="#how-it-works">How it works</a>
            <a href="#for-students">For students</a>
            <a href="#for-teachers">For teachers</a>
          </nav>
          <div className="sv-welcome-nav-actions">
            <a className="sv-github-link" href="https://github.com/risheeth26233/student-vault" target="_blank" rel="noreferrer">GitHub</a>
            <Button variant="outline" disabled={isLoading} onClick={() => void openAccount(false)}>Sign in</Button>
          </div>
        </header>

        <section className="sv-welcome-hero" aria-labelledby="welcome-title">
          <div className="sv-welcome-copy">
            <p className="sv-welcome-eyebrow"><span /> FOR SCHOOL & COLLEGE STUDENTS</p>
            <h1 id="welcome-title">Your studies,<br />in <em>one clear place.</em></h1>
            <p className="sv-welcome-lede">Keep track of classes, save notes and resources, and find a helpful next step when a topic feels difficult.</p>
            <div className="sv-welcome-actions">
              <Button size="lg" rightIcon={<ArrowRight size={18} />} onClick={() => openWorkspace()}>Explore the workspace</Button>
              <Button size="lg" variant="ghost" disabled={isLoading} onClick={() => void openAccount(true)}>Create a student account</Button>
            </div>
            <p className="sv-welcome-note">Start as a guest. Notes and attendance stay in this browser.</p>
            {(error || authError) && <p className="sv-welcome-auth-error" role="alert">{error || authError}</p>}
            <a href="#features" className="sv-scroll-link">Explore what’s inside <ArrowDownRight size={16} aria-hidden="true" /></a>
          </div>
          <StudyAtmosphere />
        </section>

        <section id="features" className="sv-section-block" aria-labelledby="features-title">
          <div className="sv-section-intro">
            <div><p className="sv-section-kicker">A calmer way to study</p><h2 id="features-title">Everything useful, close at hand.</h2></div>
            <p>From the first class note to the next practice attempt, your study tools belong together.</p>
          </div>
          <div className="sv-feature-grid">
            {features.map(({ icon: Icon, title, detail, path, tag }, index) => (
              <button key={path} type="button" onClick={() => openWorkspace(path)} className="sv-feature-card">
                <span className="sv-feature-top"><span>{tag}</span><span>0{index + 1}</span></span>
                <span className="sv-feature-icon"><Icon size={21} aria-hidden="true" /></span>
                <span className="sv-feature-title">{title}</span>
                <span className="sv-feature-detail">{detail}</span>
                <span className="sv-feature-link">Open tool <ArrowRight size={15} aria-hidden="true" /></span>
              </button>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="sv-process-section" aria-labelledby="process-title">
          <div className="sv-process-heading"><p className="sv-section-kicker">A simple learning loop</p><h2 id="process-title">From a question to a next step.</h2><p>Student-Vault keeps records and tools together. GuruGraph reads the evidence you save and explains what it can—and cannot—tell you.</p></div>
          <ol className="sv-process-list">
            {steps.map((step, index) => <li key={step}><span className="sv-process-number">0{index + 1}</span><span>{step}</span><ArrowRight size={17} aria-hidden="true" /></li>)}
          </ol>
        </section>

        <section className="sv-pathways" aria-label="Student and teacher experiences">
          <article id="for-students" className="sv-pathway-card sv-student-pathway">
            <span className="sv-pathway-icon"><BookOpen size={22} aria-hidden="true" /></span><p className="sv-section-kicker">FOR STUDENTS</p>
            <h2>Make room for the way you learn.</h2><p>Build your own topic and note library, keep deadlines visible, and use practice or study support when you need it.</p>
            <button type="button" className="sv-text-action" onClick={() => openWorkspace('/dashboard')}>Open your workspace <ArrowRight size={16} aria-hidden="true" /></button>
          </article>
          <article id="for-teachers" className="sv-pathway-card sv-teacher-pathway">
            <span className="sv-pathway-icon"><Users size={22} aria-hidden="true" /></span><p className="sv-section-kicker">FOR TEACHERS</p>
            <h2>Turn shared evidence into follow-up.</h2><p>Review records from students enrolled in your class, propose a concrete action, and compare reassessment entries over time.</p>
            <button type="button" className="sv-text-action" onClick={() => openWorkspace('/teacher')}>Explore the class workspace <ArrowRight size={16} aria-hidden="true" /></button>
          </article>
        </section>

        <section className="sv-demo-section" aria-label="Product walkthrough">
          <div><p className="sv-section-kicker">SEE IT IN ACTION</p><h2>Meet Maya in her study week.</h2><p>A short walkthrough of the everyday tools, with narration and captions.</p></div>
          <details>
            <summary>Watch the Student-Valut demo · 3 min 56 sec</summary>
            <p className="sv-demo-caption">Online video and AI features depend on configured services.</p>
            <video controls preload="none" playsInline aria-label="Student Valut narrated walkthrough">
              <source src={`${import.meta.env.BASE_URL}demo/student-valut-demo.mp4`} type="video/mp4" />
              <track kind="captions" src={`${import.meta.env.BASE_URL}demo/student-valut-demo.vtt`} srcLang="en" label="English captions" />
              Your browser does not support video playback. Use the download link below.
            </video>
            <a href={`${import.meta.env.BASE_URL}demo/student-valut-demo.mp4`} download="STUDENT-VALUT-demo.mp4" className="sv-text-action">Download the demo <FileText size={16} aria-hidden="true" /></a>
          </details>
        </section>

        <section className="sv-final-cta" aria-labelledby="final-cta-title">
          <div><p className="sv-section-kicker">YOUR NEXT SESSION STARTS HERE</p><h2 id="final-cta-title">One small step is enough.</h2><p>Open a guest workspace or create an account to keep your study records in sync.</p></div>
          <Button size="lg" rightIcon={<ArrowRight size={18} />} onClick={() => openWorkspace()}>Get started</Button>
        </section>

        <footer className="sv-welcome-footer"><a href="#top" className="sv-brand sv-brand-footer"><span className="brand-mark"><BookOpen size={17} aria-hidden="true" /></span><span>STUDENT <b>VALUT</b></span></a><span>Made for school and college study.</span><a href="https://github.com/risheeth26233/student-vault" target="_blank" rel="noreferrer">GitHub</a></footer>
      </div>
    </main>
  );
}
