import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Loader2, RefreshCw, Save, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { profileApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';

export function ProfilePage() {
  const { user, profile, setProfile, isAuthenticated } = useAuth();
  const clerkUser = user as { id?: string; firstName?: string | null; username?: string | null; emailAddresses?: Array<{ emailAddress: string }> } | null;
  const [name, setName] = useState(profile?.name || clerkUser?.firstName || clerkUser?.username || '');
  const [email, setEmail] = useState(profile?.email || clerkUser?.emailAddresses?.[0]?.emailAddress || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const accountId = clerkUser?.id;
  const publicIdQuery = useQuery({ queryKey: ['profile', 'public-id', accountId], queryFn: profileApi.publicId, enabled: Boolean(accountId && !profile?.guest), retry: 1, retryDelay: 250 });

  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Name is required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      setProfile({ name: name.trim().slice(0, 40), email: email.trim() || undefined, ...(profile?.guest ? { guest: true } : {}) });
      setMessage({ type: 'success', text: 'Profile saved on this device' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return <PageContainer><ContentWrapper className="max-w-xl"><Card elevation={1} padding="lg" className="text-center">
      <User className="mx-auto mb-4 h-16 w-16 text-border" />
      <h2 className="mb-2 text-xl font-semibold text-ink">Sign in to manage your profile</h2>
      <p className="mb-6 text-ink-muted">Please sign in to access your profile settings.</p>
      <Button onClick={() => { window.location.href = '/'; }} size="lg">Go to Dashboard</Button>
    </Card></ContentWrapper></PageContainer>;
  }

  return <PageContainer><ContentWrapper className="max-w-3xl"><div className="sv-profile space-y-6">
    <header className="page-header"><h1 className="text-3xl font-extrabold text-ink">Profile</h1><p className="text-ink-muted">Manage your account details and preferences</p></header>
    <Card elevation={1} padding="lg">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700" aria-hidden="true">{initials || <User className="h-8 w-8" />}</div>
        <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold text-ink">Profile information</h2><p className="mt-1 text-sm text-ink-muted">Your display name is saved locally. Sign-in identity and email are managed by your account provider.</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Display name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} error={message?.type === 'error' ? message.text : undefined} /></div>
        <div className="sm:col-span-2"><Input label="Email" type="email" placeholder="your@email.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!!clerkUser?.emailAddresses} /></div>
      </div>
      {clerkUser?.emailAddresses && <p className="mt-2 text-xs text-ink-muted">Email is managed by your authentication provider.</p>}
      <div className="mt-6 flex justify-end"><Button onClick={handleSave} loading={saving} leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>Save changes</Button></div>
    </Card>

    <Card elevation={1} padding="lg">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="text-lg font-semibold text-ink">Account</h2><p className="text-sm text-ink-muted">Your sign-in and Student-Vault identity</p></div></div>
      <dl className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><dt className="text-ink-muted">Sign-in provider</dt><dd className="font-medium text-ink">{accountId ? 'Clerk account' : profile?.guest ? 'Guest workspace' : 'Local profile'}</dd></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><dt className="text-ink-muted">Account status</dt><dd className="inline-flex items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-strong"><span className="h-1.5 w-1.5 rounded-full bg-success" />{accountId ? 'Signed in' : profile?.guest ? 'This device only' : 'Not connected'}</dd></div>
        <div className="space-y-2"><dt className="text-ink-muted">Student-Vault ID</dt><dd className="flex min-w-0 flex-wrap items-center gap-2">
          {publicIdQuery.isLoading ? <span role="status" className="text-ink-muted">Loading your ID…</span> : publicIdQuery.data?.publicId ? <><code className="sv-public-id">{publicIdQuery.data.publicId}</code><button type="button" className="sv-copy-id" onClick={async () => { try { await navigator.clipboard.writeText(publicIdQuery.data!.publicId); setCopied(true); } catch { setCopied(false); } }} aria-label="Copy Student-Vault ID">{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}</button></> : profile?.guest ? <span className="text-ink-muted">Available after you create an account.</span> : publicIdQuery.isError ? <><span role="status" className="text-ink-muted">ID is temporarily unavailable.</span><button type="button" className="sv-copy-id" onClick={() => void publicIdQuery.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry</button></> : <span className="text-ink-muted">Sign in to load your ID.</span>}
        </dd></div>
      </dl>
    </Card>
    {message && <div className={`flex items-center gap-2 rounded-lg p-4 text-sm font-medium ${message.type === 'success' ? 'bg-success-soft text-success-strong' : 'bg-danger-soft text-danger-strong'}`} role="status">
      {message.type === 'success' ? <Check className="h-5 w-5" aria-hidden="true" /> : <X className="h-5 w-5" aria-hidden="true" />}{message.text}
      <button type="button" onClick={() => setMessage(null)} className="ml-auto rounded p-1 hover:bg-black/10" aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>}
  </div></ContentWrapper></PageContainer>;
}
