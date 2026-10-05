// MobileNavigation Component
// Bottom navigation for mobile devices and drawer for tablet

import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Video, Search, MessageSquare, Image, Cloud,
  Menu, X, ChevronRight, Gauge, Calculator, NotebookPen, FileText, Timer, ClipboardList,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Gauge },
  { id: 'vault', label: 'Vault', href: '/vault', icon: LayoutDashboard },
  { id: 'notes', label: 'Notes', href: '/notes', icon: NotebookPen },
  { id: 'documents', label: 'Documents', href: '/documents', icon: FileText },
  { id: 'assignments', label: 'Assignments', href: '/assignments', icon: ClipboardList },
  { id: 'attendance', label: 'Attendance', href: '/attendance', icon: Calendar },
  { id: 'performance', label: 'Performance', href: '/performance', icon: TrendingUp },
  { id: 'calculator', label: 'Calculator', href: '/calculator', icon: Calculator },
  { id: 'study', label: 'Study Mode', href: '/study', icon: Timer },
  { id: 'youtube', label: 'YouTube', href: '/youtube', icon: Video },
  { id: 'search', label: 'Search', href: '/search', icon: Search },
  { id: 'ai', label: 'AI', href: '/ai', icon: MessageSquare },
  { id: 'images', label: 'Images', href: '/images', icon: Image },
  { id: 'sync', label: 'Sync', href: '/sync', icon: Cloud },
];

// Primary items for bottom nav (most important) — keep the original five
const primaryNavIds = ['vault', 'attendance', 'youtube', 'search', 'ai'];
const primaryNavItems = navItems.filter(item => primaryNavIds.includes(item.id));

export function MobileNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigation = (href: string) => {
    navigate(href);
    setDrawerOpen(false);
  };

  const displayName = (user as any)?.firstName || (user as any)?.username || profile?.name || 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  // Only show on mobile/tablet
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return null;
  }

  // Bottom Navigation (Mobile only - < 768px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <nav className="mobile-nav" role="navigation" aria-label="Primary navigation">
        <div className="flex items-center justify-around h-16">
          {primaryNavItems.map(item => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  'mobile-nav-item flex-1',
                  isActive ? 'mobile-nav-item-active' : 'mobile-nav-item-inactive'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="w-6 h-6" aria-hidden="true">
                  <Icon className="w-6 h-6" />
                </span>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Tablet: Drawer navigation (768px - 1023px)
  return (
    <>
      <div 
        className={cn('mobile-drawer-overlay', drawerOpen && 'mobile-drawer-overlay-visible')} 
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <aside 
        className={cn('mobile-drawer', drawerOpen ? 'mobile-drawer-open' : 'mobile-drawer-closed')} 
        role="navigation" 
        aria-label="Navigation drawer"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <button 
            onClick={() => handleNavigation('/vault')}
            className="flex items-center gap-3 text-ink font-extrabold text-lg"
            aria-label="Student Vault home"
          >
            <span className="brand-mark" aria-hidden="true">
              <LayoutDashboard className="w-5 h-5" />
            </span>
            <span>Student Vault</span>
          </button>
          
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-lg text-ink-muted hover:bg-teal-50 hover:text-teal-700 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map(item => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  'sidebar-nav-item w-full text-left',
                  isActive ? 'sidebar-nav-item-active' : 'sidebar-nav-item-inactive'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="sidebar-nav-item-icon" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="sidebar-nav-item-label">{item.label}</span>
                {isActive && <span className="nav-indicator" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm flex-shrink-0">
              {isAuthenticated ? initials : <Menu className="w-4 h-4" aria-hidden="true" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {displayName}
                {isAuthenticated && profile?.guest && (
                  <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide align-middle">
                    Guest
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-muted truncate">
                {isAuthenticated
                  ? (profile?.guest
                      ? 'Guest mode'
                      : ((user as any)?.emailAddresses?.[0]?.emailAddress || profile?.email || 'Local mode'))
                  : 'Guest • Local mode'
                }
              </p>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            {isAuthenticated && (
              <>
                <button
                  onClick={() => handleNavigation('/sync')}
                  className="sidebar-nav-item sidebar-nav-item-inactive w-full justify-start"
                  aria-label="Cloud Sync"
                >
                  <span className="sidebar-nav-item-icon" aria-hidden="true">
                    <Cloud className="w-5 h-5" />
                  </span>
                  <span className="sidebar-nav-item-label">Sync</span>
                </button>

                <button
                  onClick={() => handleNavigation('/profile')}
                  className="sidebar-nav-item sidebar-nav-item-inactive w-full justify-start"
                  aria-label="Settings"
                >
                  <span className="sidebar-nav-item-icon" aria-hidden="true">
                    <ChevronRight className="w-5 h-5" />
                  </span>
                  <span className="sidebar-nav-item-label">Settings</span>
                </button>

                <button
                  onClick={() => signOut()}
                  className="sidebar-nav-item w-full justify-start text-coral-600 hover:bg-coral-50"
                  aria-label="Sign out"
                >
                  <span className="sidebar-nav-item-icon" aria-hidden="true">
                    <ChevronRight className="w-5 h-5" />
                  </span>
                  <span className="sidebar-nav-item-label">Sign Out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// Export a hook for triggering the drawer from Topbar
export function useMobileDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return { drawerOpen, setDrawerOpen, toggleDrawer: () => setDrawerOpen(d => !d) };
}