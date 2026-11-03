import { useEffect, useState } from 'react';
import { Users, BookOpen, RefreshCw } from 'lucide-react';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { teacherApi, type TeacherClass, type TeacherStudent, type InterventionRecord } from '../services/api';

type ApiError = Error & { status?: number };

export function TeacherPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selected, setSelected] = useState<TeacherClass | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [topicSummary, setTopicSummary] = useState<Array<{ subject: string; title: string; studentsWithTopic: number; learning: number; reviewing: number; ready: number; assessmentCount: number; assessmentAveragePercent: number | null; latestAssessmentAt: string | null; latestEvidenceAt: string | null; evidenceFreshness: 'none' | 'recent' | 'stale'; observedSignal: 'review_indicated' | 'insufficient_evidence' | 'no_flagged_signal' }>>([]);
  const [summaryNotice, setSummaryNotice] = useState('');
  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [studentMode, setStudentMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [notice, setNotice] = useState('');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [targetTopicId, setTargetTopicId] = useState('');
  const [need, setNeed] = useState('');
  const [action, setAction] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');

  async function loadClasses() {
    setLoading(true);
    setError('');
    try {
      const result = await teacherApi.classes();
      setClasses(result.classes);
      setStudentMode(false);
    } catch (e) {
      const problem = e as ApiError;
      if (problem.status === 403) {
        setStudentMode(true);
        try { setInterventions((await teacherApi.myInterventions()).interventions); }
        catch (studentError) { setError((studentError as Error).message || 'Could not load your follow-up plans.'); }
      }
      else setError(problem.message || 'Could not load classes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadClasses(); }, []);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setNotice('');
    try {
      const classroom = await teacherApi.createClass({ name, subject: subject || undefined });
      setName(''); setSubject('');
      setNotice(`Class created. Share join code ${classroom.joinCode} with students who should enroll.`);
      await loadClasses();
    } catch (e) { setError((e as Error).message); }
  }

  async function openClass(classroom: TeacherClass) {
    setSelected(classroom); setStudents([]); setError('');
    try {
      const [roster, plans] = await Promise.all([teacherApi.students(classroom.id), teacherApi.classInterventions(classroom.id)]);
      setStudents(roster.students); setTopicSummary(roster.topicSummary); setSummaryNotice(roster.summaryNotice); setInterventions(plans.interventions);
      setTargetStudentId(roster.students[0]?.id ?? '');
      setTargetTopicId(roster.students[0]?.topics[0]?.id ?? '');
    }
    catch (e) { setError((e as Error).message); }
  }

  async function proposeIntervention(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !targetStudentId || !targetTopicId) return;
    setError(''); setNotice('');
    try {
      await teacherApi.proposeIntervention(selected.id, { studentId: targetStudentId, topicId: targetTopicId, need, action, evidenceSummary: evidenceSummary || undefined });
      setNeed(''); setAction(''); setEvidenceSummary('');
      setInterventions((await teacherApi.classInterventions(selected.id)).interventions);
      setNotice('Follow-up proposed. It will be visible to the student after teacher review.');
    } catch (e) { setError((e as Error).message); }
  }

  async function reviewIntervention(id: string, status: 'approved' | 'cancelled') {
    try {
      await teacherApi.reviewIntervention(id, status);
      if (selected) setInterventions((await teacherApi.classInterventions(selected.id)).interventions);
    } catch (e) { setError((e as Error).message); }
  }

  async function addTeacherFeedback(id: string) {
    const feedback = window.prompt('Feedback for the student:');
    if (!feedback?.trim()) return;
    try {
      await teacherApi.addInterventionFeedback(id, feedback.trim());
      if (selected) setInterventions((await teacherApi.classInterventions(selected.id)).interventions);
    } catch (e) { setError((e as Error).message); }
  }

  async function reviewStudentOutcome(id: string) {
    const feedback = window.prompt('Review feedback for the student:');
    if (!feedback?.trim()) return;
    const followUpRequired = window.confirm('Is another teacher follow-up action required?');
    try {
      await teacherApi.reviewInterventionOutcome(id, feedback.trim(), followUpRequired);
      if (selected) setInterventions((await teacherApi.classInterventions(selected.id)).interventions);
    } catch (e) { setError((e as Error).message); }
  }

  async function updateStudentIntervention(id: string, status: 'in_progress' | 'completed') {
    try {
      const outcomeNote = status === 'completed' ? window.prompt('Briefly describe what you completed or learned:') : undefined;
      if (status === 'completed' && !outcomeNote?.trim()) return;
      const plan = interventions.find((item) => item.id === id);
      let followUpScore: number | undefined;
      let followUpMaxScore: number | undefined;
      if (status === 'completed' && plan?.topicId) {
        const score = window.prompt('Enter your reassessment score (from the same topic):');
        const maximum = window.prompt('Enter the maximum possible reassessment score:');
        if (score === null || maximum === null || !/^\d+$/.test(score) || !/^\d+$/.test(maximum) || Number(maximum) < 1 || Number(score) > Number(maximum)) return;
        followUpScore = Number(score); followUpMaxScore = Number(maximum);
      }
      await teacherApi.updateMyIntervention(id, status, outcomeNote ?? undefined, followUpScore, followUpMaxScore);
      setInterventions((await teacherApi.myInterventions()).interventions);
    } catch (e) { setError((e as Error).message); }
  }

  function scoreComparison(plan: InterventionRecord) {
    if (plan.baselineScore == null || plan.baselineMaxScore == null) return 'No topic-linked baseline assessment was available when this plan was created.';
    const baseline = Math.round((plan.baselineScore / plan.baselineMaxScore) * 100);
    if (plan.followUpScore == null || plan.followUpMaxScore == null) return `Recorded baseline: ${plan.baselineScore}/${plan.baselineMaxScore} (${baseline}%). Reassessment has not been recorded.`;
    const followUp = Math.round((plan.followUpScore / plan.followUpMaxScore) * 100);
    const change = followUp - baseline;
    return `Recorded comparison: ${plan.baselineScore}/${plan.baselineMaxScore} (${baseline}%) to ${plan.followUpScore}/${plan.followUpMaxScore} (${followUp}%), ${change > 0 ? '+' : ''}${change} percentage points. This describes two records and does not establish that the plan caused the change.`;
  }

  async function acceptClass(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const joined = await teacherApi.acceptEnrollment(joinCode.trim());
      setJoinCode(''); setNotice(`You joined ${joined.className}. Its teacher can see your ${joined.subject ? `${joined.subject}-only ` : 'all saved '}topic states and assessment records for this class.`);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <PageContainer>
      <ContentWrapper>
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Classroom workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">{studentMode ? 'Join a class' : 'Teacher intelligence'}</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">{studentMode ? 'Join only a class whose teacher shared its private enrollment code with you.' : 'Review records shared by students who joined your classes. Topic states and assessment scores are observed records; this view does not claim persisted GuruGraph mastery.'}</p>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-coral-200 bg-coral-50 p-3 text-sm text-coral-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}

        {studentMode ? (
          <div>
          <Card elevation={1} padding="lg" className="max-w-xl">
            <h2 className="mb-3 text-lg font-semibold text-ink">Enter a class code</h2>
            <form onSubmit={acceptClass} className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="class-join-code">Class join code</label>
              <input id="class-join-code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} required maxLength={24} className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3" placeholder="Paste code from your teacher" />
              <Button type="submit">Join class</Button>
            </form>
          </Card>
          <section className="mt-5 max-w-xl space-y-3" aria-label="Your follow-up plans">
            <h2 className="font-semibold text-ink">Follow-up plans</h2>
            {interventions.length === 0 ? <p className="text-sm text-ink-muted">No plans have been shared with you.</p> : interventions.map((plan) => <Card key={plan.id} elevation={1} padding="md"><p className="font-medium text-ink">{plan.need}</p><p className="mt-1 text-sm text-ink-muted">{plan.action}{plan.topic ? ` · ${plan.topic.subject}: ${plan.topic.title}` : ''}</p>{plan.evidenceSummary && <p className="mt-2 text-xs text-ink-muted">Teacher evidence note: {plan.evidenceSummary}</p>}{plan.teacherFeedback && <p className="mt-2 rounded bg-teal-50 p-2 text-xs text-teal-900">Teacher feedback: {plan.teacherFeedback}</p>}{plan.reviewedAt && <p className="mt-2 text-xs text-ink-muted">Teacher reviewed · {plan.followUpRequired ? 'another follow-up is required' : 'no further follow-up was requested'}</p>}<p className="mt-2 text-xs capitalize text-ink-muted">Status: {plan.status.replace('_', ' ')}</p><p className="mt-2 text-xs text-ink-muted">{scoreComparison(plan)}</p>{plan.events?.length ? <ol className="mt-2 list-inside list-disc text-xs text-ink-muted" aria-label="Follow-up history">{plan.events.map((event) => <li key={event.id}>{event.toStatus.replace('_', ' ')} · {new Date(event.createdAt).toLocaleDateString()}{event.note ? ` · ${event.note}` : ''}</li>)}</ol> : null}{plan.status === 'approved' && <Button className="mt-3" size="sm" onClick={() => void updateStudentIntervention(plan.id, 'in_progress')}>Start action</Button>}{plan.status === 'in_progress' && <Button className="mt-3" size="sm" onClick={() => void updateStudentIntervention(plan.id, 'completed')}>Mark complete</Button>}</Card>)}
          </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.5fr)]">
            <section className="space-y-4" aria-label="Classes">
              <Card elevation={1} padding="md">
                <h2 className="mb-3 font-semibold text-ink">Create a class</h2>
                <form onSubmit={createClass} className="space-y-3">
                  <label className="block text-sm text-ink-muted">Class name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-3 text-ink" /></label>
                  <label className="block text-sm text-ink-muted">Subject (optional)<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={40} className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-3 text-ink" /></label>
                  <Button type="submit">Create class</Button>
                </form>
              </Card>
              <Card elevation={1} padding="md">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-ink">Your classes</h2><Button variant="ghost" size="sm" onClick={() => void loadClasses()} aria-label="Refresh classes"><RefreshCw className="h-4 w-4" /></Button></div>
                {loading ? <p role="status" className="text-sm text-ink-muted">Loading classes…</p> : classes.length === 0 ? <p className="text-sm text-ink-muted">No classes yet. Create one to get a student-shared roster.</p> : <ul className="space-y-2">{classes.map((classroom) => <li key={classroom.id}><button onClick={() => void openClass(classroom)} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-teal-500"><span className="block font-medium text-ink">{classroom.name}</span><span className="text-sm text-ink-muted">{classroom.subject || 'No subject'} · {classroom.activeStudents} students</span></button></li>)}</ul>}
              </Card>
            </section>
            <section aria-label="Class evidence">
              {!selected ? <Card elevation={1} padding="lg" className="text-center text-ink-muted"><Users className="mx-auto mb-2 h-8 w-8" aria-hidden="true"/><p>Select a class to review its enrolled students.</p></Card> : <Card elevation={1} padding="md"><div className="mb-4"><h2 className="text-xl font-semibold text-ink">{selected.name}</h2><p className="text-sm text-ink-muted">Enrollment code: <code className="select-all">{selected.joinCode}</code></p></div><section className="mb-5 rounded-lg bg-gray-50 p-3" aria-label="Class topic overview"><h3 className="font-semibold text-ink">Recorded topic overview</h3>{topicSummary.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{topicSummary.slice(0, 12).map((item) => <li key={`${item.subject}:${item.title}`} className="rounded border border-gray-200 bg-white p-2 text-sm"><span className="font-medium">{item.subject}: {item.title}</span><span className="block text-xs text-ink-muted">{item.studentsWithTopic} students · learning {item.learning}, reviewing {item.reviewing}, ready {item.ready}</span><span className="block text-xs text-ink-muted">{item.assessmentCount ? `${item.assessmentCount} assessments · average ${item.assessmentAveragePercent}% · latest ${item.latestAssessmentAt ? new Date(item.latestAssessmentAt).toLocaleDateString() : 'date unavailable'}` : 'No linked assessment evidence'}</span><span className="block text-xs text-ink-muted">Review signal: {item.observedSignal.replaceAll('_', ' ')} · evidence {item.evidenceFreshness}{item.latestEvidenceAt ? ` · updated ${new Date(item.latestEvidenceAt).toLocaleDateString()}` : ''}</span></li>)}</ul> : <p className="mt-1 text-sm text-ink-muted">No shared topics have been recorded.</p>}<p className="mt-2 text-xs text-ink-muted">{summaryNotice}</p></section>{students.length === 0 ? <p className="text-sm text-ink-muted">No students have joined this class yet.</p> : <ul className="space-y-4">{students.map((student) => <li key={student.id} className="rounded-lg border border-gray-200 p-4"><h3 className="font-semibold text-ink">{student.name}</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h4 className="mb-1 flex items-center gap-1 text-sm font-medium"><BookOpen className="h-4 w-4"/>Topics</h4>{student.topics.length ? <ul className="space-y-1 text-sm text-ink-muted">{student.topics.map((topic) => <li key={topic.id}>{topic.subject}: {topic.title} · {topic.status}</li>)}</ul> : <p className="text-sm text-ink-muted">No shared topics recorded.</p>}</div><div><h4 className="mb-1 text-sm font-medium">Assessments</h4>{student.assessments.length ? <ul className="space-y-1 text-sm text-ink-muted">{student.assessments.map((item) => <li key={item.id}>{item.title}: {item.score}/{item.maxScore} ({item.subject})</li>)}</ul> : <p className="text-sm text-ink-muted">No recorded assessments.</p>}</div></div><p className="mt-3 text-xs text-ink-muted">{student.evidenceNotice}</p></li>)}</ul>}</Card>}
            </section>
            {selected && <section className="lg:col-span-2" aria-label="Intervention workflow">
              <Card elevation={1} padding="md" className="space-y-4">
                <div><h2 className="text-lg font-semibold text-ink">Learning follow-up</h2><p className="text-sm text-ink-muted">Record a concrete observed need, proposed action, and source note. The student sees it after you approve.</p></div>
                <form onSubmit={proposeIntervention} className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-ink-muted">Student<select value={targetStudentId} onChange={(event) => { const student = students.find((item) => item.id === event.target.value); setTargetStudentId(event.target.value); setTargetTopicId(student?.topics[0]?.id ?? ''); }} required disabled={!students.length} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-ink"><option value="">Choose enrolled student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
                  <label className="text-sm text-ink-muted">Recorded topic<select value={targetTopicId} onChange={(event) => setTargetTopicId(event.target.value)} required disabled={!students.find((item) => item.id === targetStudentId)?.topics.length} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-ink"><option value="">Choose a topic with saved evidence</option>{(students.find((item) => item.id === targetStudentId)?.topics ?? []).map((topic) => <option key={topic.id} value={topic.id}>{topic.subject}: {topic.title} · {topic.status}</option>)}</select></label>
                  <label className="text-sm text-ink-muted">Observed learning need<input value={need} onChange={(event) => setNeed(event.target.value)} required maxLength={1000} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 px-3 text-ink" /></label>
                  <label className="text-sm text-ink-muted">Proposed action<input value={action} onChange={(event) => setAction(event.target.value)} required maxLength={1000} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 px-3 text-ink" /></label>
                  <label className="text-sm text-ink-muted">Evidence note (optional)<input value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} maxLength={2000} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 px-3 text-ink" /></label>
                  <div><Button type="submit" disabled={!students.length || !targetTopicId}>Propose follow-up</Button></div>
                </form>
                <ul className="grid gap-3 md:grid-cols-2">{interventions.map((plan) => <li key={plan.id} className="rounded-lg border border-gray-200 p-3"><p className="font-medium text-ink">{plan.student?.name}: {plan.need}</p><p className="mt-1 text-sm text-ink-muted">{plan.action}{plan.topic ? ` · ${plan.topic.subject}: ${plan.topic.title}` : ''}</p>{plan.evidenceSummary && <p className="mt-1 text-xs text-ink-muted">Evidence note: {plan.evidenceSummary}</p>}<p className="mt-2 text-xs capitalize text-ink-muted">Status: {plan.status.replace('_', ' ')}</p><p className="mt-2 text-xs text-ink-muted">{scoreComparison(plan)}</p>{plan.teacherFeedback && <p className="mt-2 text-xs text-teal-800">Your feedback: {plan.teacherFeedback}</p>}{plan.status === 'proposed' && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => void reviewIntervention(plan.id, 'approved')}>Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewIntervention(plan.id, 'cancelled')}>Decline</Button></div>}{['in_progress', 'completed'].includes(plan.status) && <Button className="mt-2" size="sm" variant="outline" onClick={() => void addTeacherFeedback(plan.id)}>Add feedback</Button>}{plan.status === 'completed' && !plan.reviewedAt && <Button className="mt-2 ml-2" size="sm" onClick={() => void reviewStudentOutcome(plan.id)}>Review outcome</Button>}{plan.reviewedAt && <p className="mt-2 text-xs text-ink-muted">Reviewed · {plan.followUpRequired ? 'follow-up required' : 'no additional follow-up'}</p>}</li>)}</ul>
              </Card>
            </section>}
          </div>
        )}
      </ContentWrapper>
    </PageContainer>
  );
}
