// EmptyState Component
// Design system primitive

import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { 
  BookOpen, Calendar, Image, Search, Video, 
  MessageSquare, Cloud 
} from 'lucide-react';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'py-8 px-4 min-h-[120px]',
        md: 'py-12 px-6 min-h-[180px]',
        lg: 'py-16 px-8 min-h-[240px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

interface IllustrationProps {
  type: 'topics' | 'attendance' | 'resources' | 'youtube' | 'search' | 'ai' | 'images' | 'sync' | 'generic';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const illustrations: Record<string, React.ComponentType<{ className?: string }>> = {
  topics: BookOpen,
  attendance: Calendar,
  resources: Image,
  youtube: Video,
  search: Search,
  ai: MessageSquare,
  images: Image,
  sync: Cloud,
  generic: BookOpen,
};

export function Illustration({ type, size = 'md', className }: IllustrationProps) {
  const Icon = illustrations[type] || illustrations.generic;
  const sizeMap = { sm: 'w-10 h-10', md: 'w-16 h-16', lg: 'w-20 h-20' };
  return <Icon className={cn('text-border', sizeMap[size], className)} aria-hidden="true" />;
}

export interface EmptyStateProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: 'topics' | 'attendance' | 'resources' | 'youtube' | 'search' | 'ai' | 'images' | 'sync' | 'generic';
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, size, title, description, action, illustration = 'generic', children, ...props }, ref) => {
    const sizeValue: 'sm' | 'md' | 'lg' = size || 'md';
    return (
      <div
        ref={ref}
        className={cn(emptyStateVariants({ size: sizeValue, className }))}
        {...props}
      >
        <Illustration type={illustration} size={sizeValue} className="mb-4" />
        <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
        {description && <p className="text-ink-muted max-w-xs mx-auto mb-6">{description}</p>}
        {action && <div className="flex items-center justify-center gap-3">{action}</div>}
        {children}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

// Pre-configured empty states for each feature
export const featureEmptyStates = {
  topics: {
    title: 'No study topics yet',
    description: 'Create your first topic to start organizing your studies.',
    illustration: 'topics' as const,
  },
  attendance: {
    title: 'No attendance subjects yet',
    description: 'Add a subject to start tracking your classes.',
    illustration: 'attendance' as const,
  },
  resources: {
    title: 'No resources attached',
    description: 'Upload PDFs or images to keep study materials with your topics.',
    illustration: 'resources' as const,
  },
  youtube: {
    title: 'Search for videos to see results here',
    description: 'Find educational videos to supplement your studies.',
    illustration: 'youtube' as const,
  },
  search: {
    title: 'Search the web to see results here',
    description: 'Find educational resources and explanations.',
    illustration: 'search' as const,
  },
  ai: {
    title: 'Start a conversation',
    description: 'Ask questions, get explanations, or brainstorm ideas.',
    illustration: 'ai' as const,
  },
  images: {
    title: 'Generate images to see them here',
    description: 'Create educational diagrams and illustrations for your topics.',
    illustration: 'images' as const,
  },
  sync: {
    title: 'Not synced yet',
    description: 'Sign in and push your data to keep it synchronized across devices.',
    illustration: 'sync' as const,
  },
};