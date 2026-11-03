import { lazy } from 'react';
import { PageBoundary } from './components/PageBoundary';
// Main App Component
// Routes and providers with animated transitions

import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { QueryProvider } from './hooks/useQueryProvider';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { NotificationProvider } from './features/notifications/NotificationProvider';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const VaultPage = lazy(() => import('./pages/VaultPage').then(module => ({ default: module.VaultPage })));
const NotesPage = lazy(() => import('./pages/NotesPage').then(module => ({ default: module.NotesPage })));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(module => ({ default: module.DocumentsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(module => ({ default: module.AttendancePage })));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then(module => ({ default: module.AssignmentsPage })));
const PerformancePage = lazy(() => import('./pages/PerformancePage').then(module => ({ default: module.PerformancePage })));
const LearningInsightsPage = lazy(() => import('./pages/LearningInsightsPage').then(module => ({ default: module.LearningInsightsPage })));
const HandwritingPage = lazy(() => import('./pages/HandwritingPage').then(module => ({ default: module.HandwritingPage })));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage').then(module => ({ default: module.CalculatorPage })));
const StudyPage = lazy(() => import('./pages/StudyPage').then(module => ({ default: module.StudyPage })));
const YouTubePage = lazy(() => import('./pages/YouTubePage').then(module => ({ default: module.YouTubePage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const AIPage = lazy(() => import('./pages/AIPage').then(module => ({ default: module.AIPage })));
const ImagesPage = lazy(() => import('./pages/ImagesPage').then(module => ({ default: module.ImagesPage })));
const SyncPage = lazy(() => import('./pages/SyncPage').then(module => ({ default: module.SyncPage })));
const TeacherPage = lazy(() => import('./pages/TeacherPage').then(module => ({ default: module.TeacherPage })));
import { LayoutDashboard, Calendar, Video, Search, MessageSquare, Image, Cloud, ArrowLeft } from 'lucide-react';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { useAuth } from './hooks/useAuth';
import { AnimatedRoutes } from './components/AnimatedRoutes';

// Legacy redirect page
function LegacyRedirect({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  const navigate = useNavigate();
  
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-ink-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        
        <Card elevation={1} padding="lg">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-teal-50 flex items-center justify-center">
              <Icon className="w-8 h-8 text-teal-600" aria-hidden="true" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-ink mb-2">{title}</h1>
              <p className="text-ink-muted mb-6">
                This feature is available in the legacy version. The React version is under development.
              </p>
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-teal-600 border-t-transparent" aria-label="Loading" />
        </div>
      </AppLayout>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function PageOutlet() {
  const location = useLocation();
  return <AnimatedRoutes><PageBoundary key={location.pathname}><Outlet /></PageBoundary></AnimatedRoutes>;
}

export function App() {
  // Get Clerk publishable key from meta tag (same as legacy)
  const metaKey = document.querySelector('meta[name="clerk-publishable-key"]');
  const publishableKey = metaKey?.getAttribute('content')?.trim() || '';

  return (
    <QueryProvider>
      <AuthProvider publishableKey={publishableKey}>
        <ToastProvider>
          <NotificationProvider>
            <BrowserRouter basename="/app">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<WelcomePage />} />
                
                {/* Protected routes */}
                <Route element={<ProtectedRoute><AppLayout><PageOutlet /></AppLayout></ProtectedRoute>}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="vault" element={<VaultPage />} />
                  <Route path="notes" element={<NotesPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="performance" element={<PerformancePage />} />
                  <Route path="insights" element={<LearningInsightsPage />} />
                  <Route path="handwriting" element={<HandwritingPage />} />
                  <Route path="assignments" element={<AssignmentsPage />} />
                  <Route path="calculator" element={<CalculatorPage />} />
                  <Route path="study" element={<StudyPage />} />
                  <Route path="youtube" element={<YouTubePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="ai" element={<AIPage />} />
                  <Route path="images" element={<ImagesPage />} />
                  <Route path="sync" element={<SyncPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="teacher" element={<TeacherPage />} />
                </Route>
                
                {/* Legacy redirect routes (for backward compatibility) */}
                <Route path="legacy/vault" element={<LegacyRedirect title="My Vault" icon={LayoutDashboard} />} />
                <Route path="legacy/attendance" element={<LegacyRedirect title="Attendance" icon={Calendar} />} />
                <Route path="legacy/youtube" element={<LegacyRedirect title="YouTube" icon={Video} />} />
                <Route path="legacy/search" element={<LegacyRedirect title="Web Search" icon={Search} />} />
                <Route path="legacy/ai" element={<LegacyRedirect title="AI Assistant" icon={MessageSquare} />} />
                <Route path="legacy/images" element={<LegacyRedirect title="Image Generation" icon={Image} />} />
                <Route path="legacy/sync" element={<LegacyRedirect title="Cloud Sync" icon={Cloud} />} />
                
                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
