/// <reference types="vite-plugin-pwa/client" />
import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  const update = useRef<(reload?: boolean) => Promise<void>>(undefined);
  useEffect(() => {
    update.current = registerSW({ immediate: true, onNeedRefresh: () => setAvailable(true) });
  }, []);
  if (!available) return null;
  return <aside role="status" className="fixed bottom-24 right-4 z-50 max-w-sm rounded-xl border border-border bg-white p-4 text-ink shadow-lg">
    <p className="font-semibold">A fresh version is ready</p>
    <p className="mt-1 text-sm text-ink-muted">Save your work, then reload to see the latest improvements.</p>
    <button type="button" onClick={() => void update.current?.(true)} className="mt-3 min-h-11 rounded-lg bg-teal-700 px-4 text-white">Reload app</button>
  </aside>;
}
