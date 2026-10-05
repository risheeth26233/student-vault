// Card Component
// Design system primitive with CVA variants

import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva(
  'rounded-xl border bg-surface transition-shadow duration-150',
  {
    variants: {
      elevation: {
        0: 'shadow-none',
        1: 'shadow-[0_1px_3px_rgba(41,71,62,0.08),0_1px_2px_rgba(41,71,62,0.06)]',
        2: 'shadow-[0_4px_12px_rgba(41,71,62,0.1),0_2px_4px_rgba(41,71,62,0.06)]',
        3: 'shadow-[0_12px_28px_rgba(41,71,62,0.12),0_4px_8px_rgba(41,71,62,0.08)]',
      },
      interactive: {
        true: 'hover:shadow-[0_12px_28px_rgba(41,71,62,0.12),0_4px_8px_rgba(41,71,62,0.08)] cursor-pointer',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      elevation: 1,
      interactive: false,
      padding: 'md',
    },
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, interactive, padding, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ elevation, interactive, padding, className }))}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mt-4 pt-4 border-t border-border', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';