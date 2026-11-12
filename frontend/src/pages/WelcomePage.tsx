import { BookOpen, CalendarCheck, NotebookPen, Sparkles, Video } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { StudyAtmosphere } from '../components/StudyAtmosphere';
import '../styles/welcome.css';

const tools = [
  { icon: CalendarCheck, title: 'Attendance calculator', description: 'Record classes and track your attendance against your target.', path: '/attendance' },
  { icon: NotebookPen, title: 'Notes and topics', description: 'Keep your notes and study materials organized by subject and topic.', path: '/notes' },
  { icon: Video, title: 'Find related videos', description: 'Look up a topic or doubt and watch a walkthrough on YouTube.', path: '/youtube' },
  { icon: Sparkles, title: 'AI study notes', description: 'Ask for a detailed explanation and save useful answers to a topic when AI is available.', path: '/ai' },
];

export function WelcomePage() {
  const { user, profile, isLoading, signIn, signUp, authError, setProfile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (user && !isLoading) return <Navigate to="/dashboard" replace />;

  function openWorkspace(path: string) {
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
    <main className="sv-welcome min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 font-extrabold tracking-wide">
            <BookOpen className="h-6 w-6 text-teal-700" aria-hidden="true" /> STUDENT VALUT
          </span>
          <Button variant="outline" disabled={isLoading} onClick={() => void openAccount(false)}>Sign in</Button>
        </header>
        <section className="sv-welcome-hero">
          <div className="sv-welcome-copy">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-700">For school and college students</p>
          <h1>Big ideas.<br />Small steps.<br /><em>Your space.</em></h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            Your everyday study workspace. Keep track of classes, collect your notes, and turn “I don’t get it” into your next breakthrough.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => openWorkspace('/dashboard')}>Continue as guest</Button>
            <Button size="lg" variant="ghost" disabled={isLoading} onClick={() => void openAccount(true)}>Create a student account</Button>
          </div>
          <p className="mt-3 text-sm text-ink-muted">Guest notes and attendance stay in this browser.</p>
          <a href="#demo" className="mt-4 inline-block font-semibold text-teal-700 underline underline-offset-4">Watch the demo</a>
          {(error || authError) && <p className="mt-3 text-sm text-ink-muted" role="alert">{error || authError}</p>}
          </div>
          <StudyAtmosphere />
        </section>
        <div className="sv-tools-heading"><h2>Everything for your next study session.</h2><span>Pick a tool. Make a start.</span></div>
        <section aria-label="Student tools" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map(({ icon: Icon, title, description, path }, index) => (
            <button key={path} type="button" onClick={() => openWorkspace(path)}
              className="sv-study-tool rounded-2xl border border-border bg-white p-5 text-left focus-visible:outline-2 focus-visible:outline-teal-600">
              <span className="sv-tool-number" aria-hidden="true">0{index + 1} ↗</span>
              <Icon className="mb-3 h-6 w-6 text-teal-700" aria-hidden="true" />
              <span className="block font-bold">{title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{description}</span>
            </button>
          ))}
        </section>
        <section id="demo" aria-label="Student Valut demo" className="mt-10 rounded-2xl border border-border p-5">
          <details>
            <summary className="cursor-pointer text-lg font-semibold">Watch the student demo · 3 min 56 sec</summary>
            <p className="my-3 text-sm text-ink-muted">Follow Maya through attendance, creating notes, and finding study help. Includes narration, calm music, and captions. Online video and AI tools require configured services.</p>
            <video controls preload="none" playsInline className="w-full rounded-xl" aria-label="Student Valut narrated walkthrough">
              <source src={`${import.meta.env.BASE_URL}demo/student-valut-demo.mp4`} type="video/mp4" />
              <track kind="captions" src={`${import.meta.env.BASE_URL}demo/student-valut-demo.vtt`} srcLang="en" label="English (also shown in video)" />
              Your browser does not support video playback. Use the download link below.
            </video>
          </details>
          <a href={`${import.meta.env.BASE_URL}demo/student-valut-demo.mp4`} download="STUDENT-VALUT-demo.mp4" className="mt-4 inline-block font-semibold text-teal-700 underline underline-offset-4">Download demo video (MP4 · 8 MB)</a>
        </section>
        <footer className="sv-welcome-footer"><span>Made for the way you learn.</span><span>School · College · Your own pace</span></footer>
      </div>
    </main>
  );
}
