// Main Layout Component
// App shell with sidebar, topbar, and content area

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNavigation } from './MobileNavigation';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const { isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync with sidebar's localStorage state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sidebar-collapsed') {
        setSidebarCollapsed(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-teal-600 border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-canvas', className)}>
      {/* Skip Link for Accessibility */}
      <a 
        href="#main-content" 
        className="skip-link"
      >
        Skip to main content
      </a>

      <Sidebar />
      
      <div className={cn(
        'app-shell transition-all duration-200 ease-out',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64',
        className
      )}>
        <Topbar />
        <main 
          id="main-content" 
          className="pt-16 min-h-[calc(100vh-4rem)]" 
          tabIndex={-1}
          role="main"
        >
          <div className="content-container">
            {children}
          </div>
        </main>
        <MobileNavigation />
      </div>
    </div>
  );
}

// Page Container for consistent page layout
interface PageContainerProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
}

export function PageContainer({ children, className, header }: PageContainerProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {header && (
        <header className="page-header">
          {header}
        </header>
      )}
      <div>{children}</div>
    </div>
  );
}

// Section component for consistent spacing
interface SectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Section({ children, className, title, description, action }: SectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || action) && (
        <div className="section-header">
          <div>
            {title && <h2 className="text-2xl font-semibold text-ink">{title}</h2>}
            {description && <p className="text-ink-muted mt-1">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Content wrapper for consistent page layout
export function ContentWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      {children}
    </div>
  );
}