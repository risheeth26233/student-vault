// Skeleton Component
// Design system primitive for loading states

import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const skeletonVariants = cva(
  'animate-pulse bg-border rounded relative overflow-hidden',
  {
    variants: {
      variant: {
        text: 'h-4 w-full',
        circular: 'rounded-full',
        rectangular: 'rounded-md',
        card: 'rounded-xl',
        avatar: 'rounded-full',
        button: 'h-10 rounded-md',
        input: 'h-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  }
);

export interface SkeletonProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, width, height, lines = 1, ...props }, ref) => {
    const isText = variant === 'text';
    const baseStyles = {
      width: width ? (typeof width === 'number' ? `${width}px` : width) : isText ? '100%' : undefined,
      height: height ? (typeof height === 'number' ? `${height}px` : height) : isText ? '1rem' : undefined,
    } as React.CSSProperties;

    if (lines > 1 && isText) {
      return (
        <div ref={ref} className={cn(skeletonVariants({ variant, className }))} style={baseStyles} {...props}>
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              className={cn(
                'mb-2 last:mb-0 rounded',
                i === lines - 1 && 'w-3/4'
              )}
              style={{ height: '1rem' }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, className }))}
        style={baseStyles}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Pre-built skeleton layouts
export function TopicCardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Skeleton variant="text" width="40%" height="0.75rem" />
        <Skeleton variant="text" width="20%" height="1.5rem" />
      </div>
      <Skeleton variant="text" width="70%" height="1.5rem" className="text-xl" />
      <Skeleton variant="text" width="100%" height="1rem" className="text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton variant="rectangular" height="1.75rem" />
        <Skeleton variant="rectangular" height="1.75rem" />
        <Skeleton variant="rectangular" height="1.75rem" />
      </div>
      <Skeleton variant="rectangular" height="6rem" className="rounded-md" />
      <div className="space-y-3">
        <Skeleton variant="text" lines={3} />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton variant="circular" width="1rem" height="1rem" className="mx-auto" />
          <Skeleton variant="circular" width="1rem" height="1rem" className="mx-auto" />
          <Skeleton variant="circular" width="1rem" height="1rem" className="mx-auto" />
        </div>
      </div>
      <div className="space-y-2 pt-4 border-t border-border">
        <Skeleton variant="rectangular" width="30%" height="2rem" />
      </div>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-video w-full rounded-md bg-border animate-pulse" />
      <div className="space-y-2">
        <Skeleton variant="text" width="80%" height="1.25rem" />
        <Skeleton variant="text" width="50%" height="0.875rem" />
        <Skeleton variant="text" width="100%" height="0.875rem" />
        <Skeleton variant="text" width="70%" height="0.875rem" />
      </div>
    </div>
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton variant="text" width="70%" height="1.25rem" />
      <Skeleton variant="text" width="100%" height="0.875rem" className="text-sm" />
      <Skeleton variant="text" width="100%" height="1rem" className="text-base" />
      <Skeleton variant="text" width="40%" height="0.75rem" className="text-xs" />
    </div>
  );
}

export function ImageCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-square w-full rounded-md bg-border animate-pulse" />
      <div className="space-y-2">
        <Skeleton variant="text" width="90%" height="1rem" lines={2} />
        <Skeleton variant="text" width="50%" height="0.75rem" className="text-xs font-mono" />
      </div>
    </div>
  );
}

export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <Skeleton variant="circular" width="2.5rem" height="2.5rem" />}
      <div className={`max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <Skeleton variant="text" width={isUser ? '60%' : '80%'} lines={3} />
      </div>
      {isUser && <Skeleton variant="circular" width="2.5rem" height="2.5rem" />}
    </div>
  );
}