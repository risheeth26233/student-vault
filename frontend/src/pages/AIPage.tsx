// AI Assistant Page - Placeholder

import { PlaceholderPage } from './PlaceholderPage';
import { MessageSquare } from 'lucide-react';

export function AIPage() {
  return (
    <PlaceholderPage
      feature="ai"
      title="AI Assistant"
      description="Ask questions, get explanations, or brainstorm ideas"
      icon={MessageSquare}
      href="/legacy/ai"
    />
  );
}