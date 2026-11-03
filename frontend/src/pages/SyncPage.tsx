import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { createFullBackupV1, downloadBackup, performFullSync, useSyncStatus } from '../hooks/useSync';
import { Button } from '../components/ui/Button';

export function SyncPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const status = useSyncStatus(!!user);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run(sync: boolean) {
    setBusy(true); setError('');
    try {
      downloadBackup(await createFullBackupV1());
      if (sync) {
        await performFullSync(setMessage);
        await client.invalidateQueries();
        setMessage('Topics, attendance and resources synchronized.');
      } else setMessage('Backup exported. Keep it private: it contains your study data.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The operation failed. Try again.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-6 p-6">
    <h1 className="text-3xl font-bold">Cloud sync and backup</h1>
    <p>Sync topics, notes, attendance and resources with your signed-in account. A local backup downloads before each sync. Conflicts stop the download from replacing your local records.</p>
    <p>Assignments, performance records and handwriting submissions are outside this sync/backup format. Keep separate copies of those records.</p>
    {!user && <p role="status">Sign in with Clerk to use cloud sync. Local backup remains available.</p>}
    {!!user && status.isError && <p role="alert">Cloud status is unavailable. <button onClick={() => void status.refetch()}>Retry</button></p>}
    {!!user && status.data && <p>Last server sync: {status.data.lastSyncedAt ? new Date(status.data.lastSyncedAt).toLocaleString() : 'Never'}</p>}
    <div className="flex gap-3"><Button disabled={busy} onClick={() => void run(false)}>Export local backup</Button><Button disabled={!user || busy} onClick={() => void run(true)}>{busy ? 'Working…' : 'Back up and sync'}</Button></div>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
