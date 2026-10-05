// Dashboard Page - Overview stats, upcoming exams, recent activity

import { useAuth } from '../hooks/useAuth';
import { useTopics } from '../hooks/useTopics';
import { useAttendanceStats } from '../hooks/useAttendance';
import { useResources } from '../hooks/useResources';
import { useAssignments, sortAssignmentsByDueDate } from '../hooks/useAssignments';
import { useAssessments, sortAssessmentsByDate } from '../hooks/useAssessments';
import { formatPercent } from '../features/performance/performanceUtils';
import { dueTreatment, PRIORITY_META, priorityLabel } from '../features/assignments/assignmentUtils';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageContainer, Section, ContentWrapper } from '../components/layout/AppLayout';
import { 
  BookOpen, Calendar, FileText, Target, TrendingUp, 
  AlertTriangle, Clock, CheckCircle, ArrowRight,
  LayoutDashboard, Plus, ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isBefore, addDays } from 'date-fns';
import { useMemo } from 'react';

export function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const { data: topicsData, isLoading: topicsLoading } = useTopics({ limit: 50 });
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendanceStats();
  const { data: resourcesData, isLoading: resourcesLoading } = useResources();
  // Loaded separately so a slow/blocked assignments API never blocks the dashboard shell.
  const { data: assignmentsData, isLoading: assignmentsLoading } = useAssignments();
  // Loaded separately for the same reason — performance never blocks the shell.
  const { data: assessmentsData, isLoading: assessmentsLoading } = useAssessments();

  // Dashboard should be accessible to guests too (local mode)
  const topics = topicsData?.topics || [];
  const attendance = attendanceData || { totalPresent: 0, totalAbsent: 0, totalClasses: 0, overallPercentage: '--', subjectsTracked: 0 };
  const resources = resourcesData?.resources || [];

  const overallLoading = isLoading || topicsLoading || attendanceLoading || resourcesLoading;

  // Compute stats
  const stats = useMemo(() => {
    const totalTopics = topics.length;
    const readyTopics = topics.filter(t => t.status === 'ready').length;
    const learningTopics = topics.filter(t => t.status === 'learning').length;
    const reviewingTopics = topics.filter(t => t.status === 'reviewing').length;
    const totalResources = resources.length;
    
    // Upcoming exams (next 14 days)
    const now = new Date();
    const twoWeeks = addDays(now, 14);
    const upcomingExams = topics
      .filter(t => t.examDate && isBefore(new Date(t.examDate), twoWeeks) && !isBefore(new Date(t.examDate), now))
      .sort((a, b) => new Date(a.examDate!).getTime() - new Date(b.examDate!).getTime())
      .slice(0, 5);

    // Overdue exams
    const overdueExams = topics
      .filter(t => t.examDate && isBefore(new Date(t.examDate), now) && t.status !== 'ready')
      .sort((a, b) => new Date(a.examDate!).getTime() - new Date(b.examDate!).getTime())
      .slice(0, 3);

    // Recent topics (recently updated)
    const recentTopics = [...topics]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);

    // Open assignments due soonest (never blocks the dashboard shell)
    const openAssignments = sortAssignmentsByDueDate(
      (assignmentsData?.assignments ?? []).filter(item => item.status !== 'completed')
    ).slice(0, 4);

    // Recent performance records (newest first) + simple mean percentage
    const allAssessments = assessmentsData?.assessments ?? [];
    const recentAssessments = sortAssessmentsByDate(allAssessments).slice(0, 4);
    const performanceAverage = allAssessments.length > 0
      ? Math.round(
          (allAssessments.reduce((sum, item) => sum + item.percentage, 0) / allAssessments.length) * 10
        ) / 10
      : 0;

    return {
      totalTopics,
      readyTopics,
      learningTopics,
      reviewingTopics,
      totalResources,
      upcomingExams,
      overdueExams,
      recentTopics,
      openAssignments,
      recentAssessments,
      performanceTotal: allAssessments.length,
      performanceAverage,
      attendance,
    };
  }, [topics, resources, attendance, assignmentsData, assessmentsData]);

  if (overallLoading) {
    return (
      <PageContainer>
        <ContentWrapper>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} elevation={1} padding="lg" className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-1/2" />
              </Card>
            ))}
          </div>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <ContentWrapper className="max-w-4xl">
          <div className="space-y-6">
            <header className="page-header">
              <h1 className="text-3xl font-extrabold text-ink">Dashboard</h1>
              <p className="text-ink-muted">Overview of your study progress</p>
            </header>

            <Card elevation={1} padding="lg" className="text-center">
              <LayoutDashboard className="w-16 h-16 text-border mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-ink mb-2">Welcome to Student Vault</h2>
              <p className="text-ink-muted mb-6 max-w-md mx-auto">
                You're viewing a local preview. Sign in to sync your data across devices and access all features.
              </p>
              <Link to="/vault">
                <Button size="lg" leftIcon={<Plus className="w-4 h-4" />}>
                  Start Studying
                </Button>
              </Link>
            </Card>
          </div>
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ContentWrapper className="max-w-6xl">
        <header className="page-header">
          <h1 className="text-3xl font-extrabold text-ink">Dashboard</h1>
          <p className="text-ink-muted">Your study overview for today</p>
        </header>

        {/* Stats Grid */}
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card elevation={1} padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-muted mb-1">Total Topics</p>
                  <p className="text-3xl font-extrabold text-ink">{stats.totalTopics}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-teal-600" />
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-ink-muted">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-teal-600" />
                  {stats.readyTopics} Ready
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  {stats.learningTopics} Learning
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-blue-600" />
                  {stats.reviewingTopics} Reviewing
                </span>
              </div>
            </Card>

            <Card elevation={1} padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-muted mb-1">Resources</p>
                  <p className="text-3xl font-extrabold text-ink">{stats.totalResources}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-muted">PDFs, images & documents attached to topics</p>
            </Card>

            <Card elevation={1} padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-muted mb-1">Attendance</p>
                  <p className="text-3xl font-extrabold text-ink">{attendance.overallPercentage}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Target className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-ink-muted">
                <span className="flex items-center gap-1 text-teal-600">
                  <CheckCircle className="w-3 h-3" />
                  {attendance.totalPresent} Present
                </span>
                <span className="flex items-center gap-1 text-coral-600">
                  <AlertTriangle className="w-3 h-3" />
                  {attendance.totalAbsent} Absent
                </span>
              </div>
            </Card>

            <Card elevation={1} padding="lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-muted mb-1">Subjects Tracked</p>
                  <p className="text-3xl font-extrabold text-ink">{attendance.subjectsTracked}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-muted">{attendance.totalClasses} total classes recorded</p>
            </Card>
          </div>
        </Section>

        {/* Upcoming Exams & Overdue */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Exams */}
          <Section title="Upcoming Exams" action={
            stats.upcomingExams.length > 0 ? (
              <Link to="/vault" className="text-sm text-teal-600 hover:underline">
                View all →
              </Link>
            ) : null
          }>
            {stats.upcomingExams.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-ink-muted">No upcoming exams in the next 14 days</p>
                <Link to="/vault" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
                  Add an exam date to a topic
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingExams.map(topic => {
                  const daysLeft = Math.ceil((new Date(topic.examDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 3;
                  return (
                    <Link 
                      key={topic.id}
                      to={`/vault?topic=${topic.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg bg-canvas border border-border hover:border-teal-300 transition-colors group"
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isUrgent ? 'bg-coral-100 text-coral-600' : 'bg-teal-100 text-teal-600'
                      }`}>
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{topic.subject} — {topic.title}</p>
                        <p className="text-sm text-ink-muted">
                          {format(new Date(topic.examDate!), 'MMM d, yyyy')} 
                          <span className={`ml-2 font-medium ${isUrgent ? 'text-coral-600' : 'text-teal-600'}`}>
                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}
                          </span>
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-teal-600 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Overdue Exams */}
          {stats.overdueExams.length > 0 && (
            <Section title="Overdue Exams">
              <div className="space-y-3" role="alert">
                {stats.overdueExams.map(topic => (
                  <div key={topic.id} className="p-3 rounded-lg bg-coral-50 border border-coral-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-coral-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-coral-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-coral-700 truncate">{topic.subject} — {topic.title}</p>
                      <p className="text-sm text-coral-600">
                        Exam was {format(new Date(topic.examDate!), 'MMM d, yyyy')} — still marked as {topic.status}
                      </p>
                    </div>
                    <Link 
                      to={`/vault?topic=${topic.id}`}
                      className="text-sm font-medium text-coral-700 hover:underline"
                    >
                      Update status
                    </Link>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent Activity */}
          <Section title="Recent Activity" action={
            stats.recentTopics.length > 0 ? (
              <Link to="/vault" className="text-sm text-teal-600 hover:underline">
                View all →
              </Link>
            ) : null
          }>
            {stats.recentTopics.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-ink-muted">No recent activity</p>
                <Link to="/vault" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
                  Create your first topic
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentTopics.map(topic => (
                  <div key={topic.id} className="flex items-center gap-3 p-3 rounded-lg bg-canvas border border-border">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{topic.subject} — {topic.title}</p>
                      <p className="text-sm text-ink-muted">
                        Updated {format(new Date(topic.updatedAt), 'MMM d, yyyy HH:mm')} • {topic.status}
                      </p>
                    </div>
                    <Badge variant={topic.status === 'ready' ? 'success' : topic.status === 'reviewing' ? 'warning' : 'info'}>
                      {topic.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Upcoming Assignments */}
          <Section title="Upcoming Assignments" action={
            <Link to="/assignments" className="text-sm text-teal-600 hover:underline">
              View all →
            </Link>
          }>
            {assignmentsLoading ? (
              <div className="space-y-3" data-testid="dashboard-assignments-loading">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-canvas border border-border animate-pulse" />
                ))}
              </div>
            ) : stats.openAssignments.length === 0 ? (
              <div className="text-center py-8" data-testid="dashboard-no-assignments">
                <ClipboardList className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-ink-muted">No open assignments</p>
                <Link to="/assignments" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
                  Add an assignment
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.openAssignments.map(assignment => {
                  const due = dueTreatment(assignment.dueDate, assignment.status);
                  return (
                    <Link
                      key={assignment.id}
                      to="/assignments"
                      className="flex items-center gap-4 p-3 rounded-lg bg-canvas border border-border hover:border-teal-300 transition-colors group"
                      data-testid="dashboard-assignment-row"
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        due.kind === 'overdue' ? 'bg-coral-100 text-coral-600' : 'bg-teal-100 text-teal-600'
                      }`}>
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{assignment.title}</p>
                        <p className="text-sm text-ink-muted">
                          {assignment.subject}
                          <span className={`ml-2 font-medium ${
                            due.kind === 'overdue' ? 'text-coral-600' : 'text-teal-600'
                          }`}>
                            {due.label}
                          </span>
                        </p>
                      </div>
                      <Badge variant={PRIORITY_META[assignment.priority].variant}>
                        {priorityLabel(assignment.priority)}
                      </Badge>
                      <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-teal-600 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Recent Performance */}
          <Section title="Recent Performance" action={
            <Link to="/performance" className="text-sm text-teal-600 hover:underline">
              View all →
            </Link>
          }>
            {assessmentsLoading ? (
              <div className="space-y-3" data-testid="dashboard-performance-loading">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-canvas border border-border animate-pulse" />
                ))}
              </div>
            ) : stats.recentAssessments.length === 0 ? (
              <div className="text-center py-8" data-testid="dashboard-no-performance">
                <TrendingUp className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-ink-muted">No results recorded yet</p>
                <Link to="/performance" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
                  Log your first result
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  to="/performance"
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-teal-50 px-3 py-2.5"
                  data-testid="dashboard-performance-summary"
                >
                  <span className="text-sm font-medium text-teal-700">
                    {stats.performanceTotal} {stats.performanceTotal === 1 ? 'record' : 'records'} logged
                  </span>
                  <span className="text-lg font-extrabold text-teal-700">
                    {formatPercent(stats.performanceAverage)}
                  </span>
                </Link>
                {stats.recentAssessments.map(assessment => (
                  <Link
                    key={assessment.id}
                    to="/performance"
                    className="flex items-center gap-4 p-3 rounded-lg bg-canvas border border-border hover:border-teal-300 transition-colors group"
                    data-testid="dashboard-assessment-row"
                  >
                    <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{assessment.title}</p>
                      <p className="text-sm text-ink-muted truncate">
                        {assessment.subject}
                        <span className="ml-2 text-teal-600 font-medium">
                          {assessment.score}/{assessment.maxScore}
                        </span>
                      </p>
                    </div>
                    <Badge variant="default">
                      {formatPercent(assessment.percentage)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Quick Actions */}
          <Section title="Quick Actions">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link to="/vault" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-teal-100 transition-colors">
                    <Plus className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Add Topic</h3>
                  <p className="text-sm text-ink-muted">Create a new study topic</p>
                </Card>
              </Link>
              <Link to="/attendance" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-100 transition-colors">
                    <Target className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Mark Attendance</h3>
                  <p className="text-sm text-ink-muted">Record present/absent</p>
                </Card>
              </Link>
              <Link to="/youtube" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-red-100 transition-colors">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Find Videos</h3>
                  <p className="text-sm text-ink-muted">Search YouTube</p>
                </Card>
              </Link>
              <Link to="/search" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 transition-colors">
                    <LayoutDashboard className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Web Search</h3>
                  <p className="text-sm text-ink-muted">Find resources</p>
                </Card>
              </Link>
              <Link to="/ai" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-100 transition-colors">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">AI Assistant</h3>
                  <p className="text-sm text-ink-muted">Ask questions</p>
                </Card>
              </Link>
              <Link to="/assignments" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-teal-100 transition-colors">
                    <ClipboardList className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Add Assignment</h3>
                  <p className="text-sm text-ink-muted">Track a new deadline</p>
                </Card>
              </Link>
              <Link to="/performance" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-teal-100 transition-colors">
                    <TrendingUp className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Log Result</h3>
                  <p className="text-sm text-ink-muted">Record a quiz or exam score</p>
                </Card>
              </Link>
              <Link to="/images" className="group">
                <Card elevation={1} padding="lg" className="h-full text-center group-hover:border-teal-300 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-pink-100 transition-colors">
                    <FileText className="w-6 h-6 text-pink-600" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1">Generate Images</h3>
                  <p className="text-sm text-ink-muted">Create diagrams</p>
                </Card>
              </Link>
            </div>
          </Section>
        </div>
      </ContentWrapper>
    </PageContainer>
  );
}