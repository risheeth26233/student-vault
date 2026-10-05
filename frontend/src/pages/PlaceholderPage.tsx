// Placeholder Page Component
// Used for views not yet implemented

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { featureEmptyStates } from '../components/ui/EmptyState';
import { ArrowLeft, Construction, LayoutDashboard, Calendar, Video, Search, MessageSquare, Image, Cloud } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlaceholderPageProps {
  feature: keyof typeof featureEmptyStates;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  backHref?: string;
}

export function PlaceholderPage({ 
  feature, 
  title, 
  description, 
  icon: Icon, 
  href,
  backHref = '/vault'
}: PlaceholderPageProps) {
  const emptyState = featureEmptyStates[feature];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to={backHref} 
          className="p-2 rounded-lg text-ink-muted hover:bg-gray-100 hover:text-ink transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Under Development</p>
          <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
        </div>
      </div>

      {/* Main Card */}
      <Card elevation={1} padding="lg" className="max-w-3xl">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-teal-50 flex items-center justify-center">
            <Icon className="w-8 h-8 text-teal-600" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-ink mb-2">{emptyState?.title || title}</h2>
            <p className="text-ink-muted mb-6">{emptyState?.description || description}</p>
            
            <div className="space-y-3 text-sm text-ink-muted">
              <p>This feature is being redesigned as part of the React migration.</p>
              <p>The existing functionality remains available in the legacy version.</p>
            </div>

            {href && (
              <Link to={href} className="mt-4 inline-flex items-center gap-2">
                <Button variant="outline" size="sm">
                  View Legacy Version
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Feature Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'My Vault', href: '/vault', icon: LayoutDashboard, desc: 'Topics, notes & resources' },
          { label: 'Attendance', href: '/attendance', icon: Calendar, desc: 'Track class attendance' },
          { label: 'YouTube', href: '/youtube', icon: Video, desc: 'Educational video search' },
          { label: 'Web Search', href: '/search', icon: Search, desc: 'Find study resources' },
          { label: 'AI Assistant', href: '/ai', icon: MessageSquare, desc: 'Study help & explanations' },
          { label: 'Image Gen', href: '/images', icon: Image, desc: 'Educational diagrams' },
          { label: 'Cloud Sync', href: '/sync', icon: Cloud, desc: 'Backup & sync data' },
        ].map((item) => (
          <Link key={item.label} to={item.href}>
            <Card 
              elevation={1} 
              padding="md" 
              interactive 
              className="flex items-center gap-4 h-full"
            >
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-teal-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink truncate">{item.label}</p>
                <p className="text-sm text-ink-muted truncate">{item.desc}</p>
              </div>
              <Construction className="w-5 h-5 text-ink-subtle" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}