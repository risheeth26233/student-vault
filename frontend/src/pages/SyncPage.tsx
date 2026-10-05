// Sync Page - Placeholder

import { PlaceholderPage } from './PlaceholderPage';
import { Cloud } from 'lucide-react';

export function SyncPage() {
  return (
    <PlaceholderPage
      feature="sync"
      title="Cloud Sync"
      description="Keep your data synchronized across devices"
      icon={Cloud}
      href="/legacy/sync"
    />
  );
}