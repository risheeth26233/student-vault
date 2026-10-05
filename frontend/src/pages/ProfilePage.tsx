// Profile Page - Student profile management

import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { User, Save, Loader2, Camera, X } from 'lucide-react';
import { useState, useCallback } from 'react';

export function ProfilePage() {
  const { user, profile, setProfile, isAuthenticated } = useAuth();
  const [name, setName] = useState(profile?.name || (user as any)?.firstName || (user as any)?.username || '');
  const [email, setEmail] = useState(profile?.email || (user as any)?.emailAddresses?.[0]?.emailAddress || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const newProfile = { name: name.trim().slice(0, 40), email: email.trim() || undefined, ...(profile?.guest ? { guest: true } : {}) };
      setProfile(newProfile);
      setMessage({ type: 'success', text: 'Profile saved successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  }, [name, email, setProfile, profile?.guest]);

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <ContentWrapper className="max-w-xl">
          <Card elevation={1} padding="lg" className="text-center">
            <User className="w-16 h-16 text-border mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-ink mb-2">Sign in to manage your profile</h2>
            <p className="text-ink-muted mb-6">Please sign in to access your profile settings.</p>
            <Button onClick={() => window.location.href = '/'} size="lg">
              Go to Dashboard
            </Button>
          </Card>
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ContentWrapper className="max-w-2xl">
        <div className="space-y-6">
          <header className="page-header">
            <h1 className="text-3xl font-extrabold text-ink">Profile</h1>
            <p className="text-ink-muted">Manage your account settings and preferences</p>
          </header>

          {/* Profile Card */}
          <Card elevation={1} padding="lg">
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-2xl">
                  {initials}
                </div>
                <button 
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                  aria-label="Change avatar"
                  disabled={!saving}
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-ink">Profile Information</h2>
                <p className="text-ink-muted text-sm mt-1">Update your display name and email</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Input
                label="Display Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                error={message?.type === 'error' ? message.text : undefined}
              />
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!(user as any)?.emailAddresses} // Can't change Clerk email from here
              />
              {(user as any)?.emailAddresses && (
                <p className="text-xs text-ink-muted">
                  Email is managed by your authentication provider (Clerk).
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handleSave} 
                loading={saving}
                leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </Card>

          {/* Account Info */}
          <Card elevation={1} padding="lg">
            <h3 className="text-lg font-semibold text-ink mb-4">Account</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Authentication</dt>
                <dd className="text-ink font-medium">
                  {(user as any)?.emailAddresses
                    ? 'Clerk (Cloud)'
                    : profile?.guest
                      ? 'Guest (local demo)'
                      : 'Local Only'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">User ID</dt>
                <dd className="text-ink font-mono truncate max-w-xs">
                  {(user as any)?.id || 'local-user'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Profile Stored</dt>
                <dd className="text-ink">
                  {profile ? 'localStorage (synced to cloud when signed in)' : 'Not saved'}
                </dd>
              </div>
            </dl>
          </Card>

          {message && (
            <div 
              className={`p-4 rounded-lg text-sm font-medium ${
                message.type === 'success' 
                  ? 'bg-teal-50 text-teal-700' 
                  : 'bg-coral-50 text-coral-700'
              } flex items-center gap-2`}
              role="alert"
            >
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {message.text}
              <button 
                onClick={() => setMessage(null)}
                className="ml-auto p-1 hover:bg-black/10 rounded"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </ContentWrapper>
    </PageContainer>
  );
}