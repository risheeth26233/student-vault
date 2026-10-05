// Welcome Page - Landing / Auth page

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AppLayout } from '../components/layout/AppLayout';
import { BookOpen, GraduationCap, Target, Sparkles, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export function WelcomePage() {
  const { isAuthenticated, signIn, setProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/vault', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  // Enter the workspace with a local guest profile (no account, stays on this device)
  const handleGuest = () => {
    setProfile({ name: 'Guest', guest: true });
    navigate('/vault');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Enter your name to continue');
      return;
    }

    setLoading(true);
    
    // If Clerk is configured, use it
    if (window.Clerk?.session) {
      try {
        await signIn();
        return;
      } catch {
        setError('Sign in failed. Please try again.');
        setLoading(false);
      }
      return;
    }

    // Local fallback
    const newProfile = { name: name.trim().slice(0, 40), email: email.trim() || undefined };
    setProfile(newProfile);
    navigate('/vault');
  };

  const features = [
    { icon: BookOpen, title: 'Study by Topic', desc: 'Organize subjects, topics, and exam dates with checklists' },
    { icon: GraduationCap, title: 'Track Attendance', desc: 'Mark classes present/absent and monitor your percentage' },
    { icon: Target, title: 'Attach Resources', desc: 'Keep PDFs and images with the right topic' },
    { icon: Sparkles, title: 'AI Assistant', desc: 'Get explanations, generate diagrams, search the web' },
  ];

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 text-teal-700 text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" aria-hidden="true"></span>
              Student Workspace
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight mb-4">
              Prepare with a plan.
            </h1>
            <p className="text-lg sm:text-xl text-ink-muted max-w-2xl mx-auto mb-8">
              Organize your subjects, study resources, and exam revision in one focused place.
            </p>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-border text-sm text-ink-muted">
                  <feature.icon className="w-4 h-4 text-teal-600" aria-hidden="true" />
                  <span className="font-medium text-ink">{feature.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Login Form */}
          <Card elevation={1} padding="lg">
            <div className="text-center mb-6">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Your Profile</p>
              <h2 className="text-2xl font-semibold text-ink">Set up your vault</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Your name"
                placeholder="Aarav"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                maxLength={40}
                error={error}
              />
              <Input
                label="Email (optional)"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              
              {error && (
                <p className="text-sm text-coral-600 font-medium" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Continue to vault
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-ink-muted">
              Or <button type="button" onClick={handleGuest} className="text-teal-600 hover:underline font-medium">continue as guest</button> (local only)
            </p>
          </Card>

          {/* Quick Tool */}
          <div className="mt-8 text-center">
            <Card elevation={1} padding="lg" className="max-w-md mx-auto">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Quick Tool</p>
                  <h3 className="font-semibold text-ink">Attendance Calculator</h3>
                </div>
              </div>
              <p className="text-ink-muted mb-6">Mark each subject present or absent. No login needed.</p>
              <Link to="/attendance">
                <Button variant="outline" className="w-full">
                  Open calculator
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}