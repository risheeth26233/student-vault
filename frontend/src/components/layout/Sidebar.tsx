// Sidebar Component
// Polished desktop sidebar with navigation, branding, and profile area

import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Video, Search, MessageSquare, Image, Cloud, 
  ChevronLeft, ChevronRight, User, Settings, LogOut, Moon, Sun, BookOpen, Gauge,
  Calculator, NotebookPen, FileText, Timer, ClipboardList, TrendingUp, Lightbulb
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Gauge },
  { id: 'vault', label: 'My Vault', href: '/vault', icon: LayoutDashboard },
  { id: 'notes', label: 'Notes', href: '/notes', icon: NotebookPen },
  { id: 'documents', label: 'Documents', href: '/documents', icon: FileText },
  { id: 'assignments', label: 'Assignments', href: '/assignments', icon: ClipboardList },
  { id: 'attendance', label: 'Attendance', href: '/attendance', icon: Calendar },
  { id: 'performance', label: 'Performance', href: '/performance', icon: TrendingUp },
  { id: 'insights', label: 'Insights', href: '/insights', icon: Lightbulb },
  { id: 'calculator', label: 'Calculator', href: '/calculator', icon: Calculator },
  { id: 'study', label: 'Study Mode', href: '/study', icon: Timer },
  { id: 'youtube', label: 'YouTube', href: '/youtube', icon: Video },
  { id: 'search', label: 'Search', href: '/search', icon: Search },
  { id: 'ai', label: 'AI Assistant', href: '/ai', icon: MessageSquare },
  { id: 'images', label: 'Images', href: '/images', icon: Image },
  { id: 'sync', label: 'Sync', href: '/sync', icon: Cloud },
];

export function Sidebar() {
  const { user, profile, isAuthenticated, signOut, setProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setTheme(saved as 'light' | 'dark');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const displayName = (user as any)?.firstName || (user as any)?.username || profile?.name || 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleNavigation = (href: string) => {
    navigate(href);
    if (window.innerWidth < 1024) {
      setCollapsed(false);
    }
  };

  return (
    <>
      <div 
        className={cn('sidebar-overlay', !collapsed && 'sidebar-overlay-visible')} 
        onClick={() => setCollapsed(false)}
        aria-hidden="true"
      />

      <aside 
        className={cn('sidebar', collapsed && 'sidebar-collapsed')} 
        role="navigation" 
        aria-label="Main navigation"
        data-collapsed={collapsed}
      >
        <div className={cn('flex items-center justify-between h-16 px-3 border-b border-border', collapsed && 'justify-center px-0')}>
          <button 
            onClick={() => navigate('/vault')}
            className={cn('flex items-center gap-3 text-ink font-extrabold text-lg transition-opacity', collapsed && 'opacity-0 pointer-events-none w-0')}
            aria-label="Student Vault home"
          >
            <span className="brand-mark" aria-hidden="true">
              <BookOpen className="w-5 h-5" />
            </span>
            <span>Student Vault</span>
          </button>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn('p-2 rounded-lg text-ink-muted hover:bg-teal-50 hover:text-teal-700 transition-colors', collapsed && 'ml-auto')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
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
                {!collapsed && (
                  <span className="sidebar-tooltip">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={cn('p-3 border-t border-border', collapsed && 'px-0')}>
          {!collapsed && (
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="sidebar-nav-item sidebar-nav-item-inactive w-full justify-center"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <span className="sidebar-nav-item-icon" aria-hidden="true">
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </span>
              <span className="sidebar-nav-item-label">
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </button>
            )}

          <div className={cn('mt-3', collapsed && 'px-2')}>
            {isAuthenticated ? (
              <>
                <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center')}>
                  <div 
                    className={cn('w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm flex-shrink-0', collapsed && 'mx-auto')}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className={cn('flex-1 min-w-0', collapsed && 'hidden')}>
                    <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                      <span className="truncate">{displayName}</span>
                      {profile?.guest && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                          Guest
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {profile?.guest
                        ? 'Guest mode'
                        : (user as any)?.emailAddresses?.[0]?.emailAddress || profile?.email || 'Local mode'}
                    </p>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => navigate('/sync')}
                    className={cn('sidebar-nav-item sidebar-nav-item-inactive w-full justify-start', collapsed && 'justify-center')}
                    aria-label="Cloud Sync"
                  >
                    <span className="sidebar-nav-item-icon" aria-hidden="true">
                      <Cloud className="w-5 h-5" />
                    </span>
                    <span className="sidebar-nav-item-label">Sync</span>
                    {!collapsed && <span className="sidebar-tooltip">Sync</span>}
                  </button>

                  <button
                    onClick={() => navigate('/profile')}
                    className={cn('sidebar-nav-item sidebar-nav-item-inactive w-full justify-start', collapsed && 'justify-center')}
                    aria-label="Settings"
                  >
                    <span className="sidebar-nav-item-icon" aria-hidden="true">
                      <Settings className="w-5 h-5" />
                    </span>
                    <span className="sidebar-nav-item-label">Settings</span>
                    {!collapsed && <span className="sidebar-tooltip">Settings</span>}
                  </button>

                  <button
                    onClick={() => signOut()}
                    className={cn('sidebar-nav-item w-full justify-start text-coral-600 hover:bg-coral-50', collapsed && 'justify-center')}
                    aria-label="Sign out"
                  >
                    <span className="sidebar-nav-item-icon" aria-hidden="true">
                      <LogOut className="w-5 h-5" />
                    </span>
                    <span className="sidebar-nav-item-label">Sign Out</span>
                    {!collapsed && <span className="sidebar-tooltip">Sign Out</span>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={cn('flex items-center justify-center gap-3 px-2 py-2', collapsed && 'px-0')}>
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm flex-shrink-0">
                    <User className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className={cn('flex-1 min-w-0', collapsed && 'hidden')}>
                    <p className="text-sm font-medium text-ink">Guest</p>
                    <p className="text-xs text-ink-muted">Local mode</p>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setProfile({ name: 'Guest', guest: true });
                      navigate('/vault');
                    }}
                    className={cn('sidebar-nav-item w-full justify-center bg-teal-600 text-white hover:bg-teal-700')}
                    aria-label="Continue as Guest"
                  >
                    <span className="sidebar-nav-item-icon" aria-hidden="true">
                      <LayoutDashboard className="w-5 h-5" />
                    </span>
                    <span className="sidebar-nav-item-label">Continue as Guest</span>
                    {!collapsed && <span className="sidebar-tooltip">Continue as Guest</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}