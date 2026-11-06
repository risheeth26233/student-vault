import { BookOpen, CalendarCheck, NotebookPen, Sparkles, Video } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const tools = [
  { icon: CalendarCheck, title: 'Attendance calculator', description: 'Record classes and track your attendance against your target.', path: '/attendance' },
  { icon: NotebookPen, title: 'Notes and topics', description: 'Keep your notes and study materials organized by subject and topic.', path: '/notes' },
  { icon: Video, title: 'Find related videos', description: 'Look up a topic or doubt and watch a walkthrough on YouTube.', path: '/youtube' },
  { icon: Sparkles, title: 'AI study notes', description: 'Ask for a detailed explanation and save useful answers to a topic when AI is available.', path: '/ai' },
];

export function WelcomePage() {
  const { isAuthenticated, isLoading, signIn, signUp, authError, setProfile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (isAuthenticated && !isLoading) return <Navigate to="/dashboard" replace />;

  function openWorkspace(path: string) {
    setProfile({ name: 'Guest', guest: true });
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
    <main className="min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 font-extrabold tracking-wide">
            <BookOpen className="h-6 w-6 text-teal-700" aria-hidden="true" /> STUDENT VALUT
          </span>
          <Button variant="outline" disabled={isLoading} onClick={() => void openAccount(false)}>Sign in</Button>
        </header>
        <section className="py-12 sm:py-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-700">For school and college students</p>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Your everyday study workspace</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            Keep track of classes, store your notes, and find help when a topic leaves you with a question.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" disabled={isLoading} onClick={() => openWorkspace('/dashboard')}>Continue as guest</Button>
            <Button size="lg" variant="ghost" disabled={isLoading} onClick={() => void openAccount(true)}>Create a student account</Button>
          </div>
          <p className="mt-3 text-sm text-ink-muted">Guest notes and attendance stay in this browser.</p>
          {(error || authError) && <p className="mt-3 text-sm text-ink-muted" role="alert">{error || authError}</p>}
        </section>
        <section aria-label="Student tools" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map(({ icon: Icon, title, description, path }) => (
            <button key={path} type="button" disabled={isLoading} onClick={() => openWorkspace(path)}
              className="rounded-2xl border border-border bg-white p-5 text-left transition-colors hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-teal-600">
              <Icon className="mb-3 h-6 w-6 text-teal-700" aria-hidden="true" />
              <span className="block font-bold">{title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{description}</span>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
