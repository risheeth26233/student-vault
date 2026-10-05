// Topbar Component
// Main application top bar with search, connection status, and profile menu

import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Cloud, LogOut, User, Search, 
  Wifi, WifiOff, ChevronDown, Settings, BookOpen,
  Calendar, Video, MessageSquare, Image, Gauge, Calculator, NotebookPen, FileText,
  Timer, ClipboardList, TrendingUp
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuLabel 
} from '../ui/DropdownMenu';
import { NotificationBell } from '../../features/notifications/NotificationBell';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Gauge },
  { id: 'vault', label: 'My Vault', href: '/vault', icon: BookOpen },
  { id: 'notes', label: 'Notes', href: '/notes', icon: NotebookPen },
  { id: 'documents', label: 'Documents', href: '/documents', icon: FileText },
  { id: 'assignments', label: 'Assignments', href: '/assignments', icon: ClipboardList },
  { id: 'attendance', label: 'Attendance', href: '/attendance', icon: Calendar },
  { id: 'performance', label: 'Performance', href: '/performance', icon: TrendingUp },
  { id: 'calculator', label: 'Calculator', href: '/calculator', icon: Calculator },
  { id: 'study', label: 'Study Mode', href: '/study', icon: Timer },
  { id: 'youtube', label: 'YouTube', href: '/youtube', icon: Video },
  { id: 'search', label: 'Search', href: '/search', icon: Search },
  { id: 'ai', label: 'AI Assistant', href: '/ai', icon: MessageSquare },
  { id: 'images', label: 'Images', href: '/images', icon: Image },
  { id: 'sync', label: 'Sync', href: '/sync', icon: Cloud },
  { id: 'profile', label: 'Profile', href: '/profile', icon: User },
];

export function Topbar() {
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [globalQuery, setGlobalQuery] = useState('');
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = (user as any)?.firstName || (user as any)?.username || profile?.name || 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleNavigation = (href: string) => {
    navigate(href);
    setMobileMenuOpen(false);
  };

  // Get current page title for breadcrumb
  const getCurrentPageTitle = () => {
    const item = navItems.find(n => location.pathname === n.href || location.pathname.startsWith(n.href + '/'));
    return item?.label || 'Dashboard';
  };

  return (
    <header className="topbar" role="banner">
      <div className="max-w-7xl mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left: Mobile Menu + Brand + Page Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-ink-muted hover:bg-teal-50 hover:text-teal-700 transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <button 
              onClick={() => handleNavigation('/vault')}
              className="flex items-center gap-3 text-ink font-extrabold text-lg"
              aria-label="Student Vault home"
            >
              <span className="brand-mark" aria-hidden="true">
                <BookOpen className="w-5 h-5" />
              </span>
              <span className="hidden lg:block">Student Vault</span>
            </button>

            {/* Page Title (Desktop) */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-sm font-medium">
                <span className="text-ink-muted">/</span>
                <span>{getCurrentPageTitle()}</span>
              </div>
            </div>
          </div>

          {/* Center: Global Search (Desktop) */}
          <form
            className="hidden lg:flex lg:flex-1 lg:max-w-xl"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = globalQuery.trim();
              navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
            }}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-subtle" aria-hidden="true" />
              <input
                type="search"
                value={globalQuery}
                onChange={(event) => setGlobalQuery(event.target.value)}
                placeholder="Search topics, resources, web..."
                className="w-full pl-10 pr-4 py-2 bg-teal-50 border border-border rounded-lg text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                aria-label="Global search"
              />
            </div>
          </form>

          {/* Right Side */}
          <div className="flex items-center gap-3 h-full relative">
            {/* Connection Status */}
            <div 
              className={cn(
                'connection-status hidden sm:flex',
                connectionStatus === 'online' ? 'connection-status-online' : 'connection-status-offline'
              )}
              role="status"
              aria-live="polite"
            >
              {connectionStatus === 'online' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* Profile Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="profile-menu-trigger flex items-center gap-2" aria-label="User menu">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm" aria-hidden="true">
                      {initials}
                    </div>
                    <span className="hidden sm:block font-medium text-ink">{displayName}</span>
                    {profile?.guest && (
                      <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                        Guest
                      </span>
                    )}
                    <ChevronDown className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
                  <DropdownMenuLabel className="font-semibold text-ink">Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleNavigation('/sync')}
                    className="flex items-center gap-2"
                    inset
                  >
                    <Cloud className="w-4 h-4" aria-hidden="true" />
                    Sync
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleNavigation('/profile')}
                    className="flex items-center gap-2"
                    inset
                  >
                    <User className="w-4 h-4" aria-hidden="true" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleNavigation('/profile')}
                    className="flex items-center gap-2"
                    inset
                  >
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => signOut()}
                    className="flex items-center gap-2 text-coral-600 focus:text-coral-600"
                    inset
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => handleNavigation('/vault')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Menu - rendered as sibling to max-w-7xl container */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          className="lg:hidden py-4 border-t border-border animate-slide-in"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <nav className="flex flex-col gap-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors w-full text-left',
                    isActive ? 'bg-teal-50 text-teal-700' : 'text-ink-muted hover:bg-teal-50 hover:text-teal-700'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            {isAuthenticated && (
              <>
                <hr className="my-2 border-border" />
                <button
                  onClick={() => handleNavigation('/sync')}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-ink-muted hover:bg-teal-50 hover:text-teal-700 transition-colors w-full text-left"
                >
                  <Cloud className="w-5 h-5" aria-hidden="true" />
                  Sync
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-coral-600 hover:bg-coral-50 transition-colors w-full text-left"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                  Sign Out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}