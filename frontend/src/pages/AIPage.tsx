import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { aiApi } from '../services/api';
import type { AIMessage, AIStudyResponse } from '../types/api';
import { useAllTopics, useSaveTopicNotes } from '../hooks/useTopics';
import { getTopic } from '../services/topicStore';
import { useResources } from '../hooks/useResources';
import { buildLocalPracticePrompt, buildOfflineStudyGuide } from '../features/ai/offlineStudyGuide';
import { createSystemPrompt } from '../hooks/useAI';

type Turn = { role: 'user' | 'assistant'; content: string; study?: AIStudyResponse; offline?: boolean };
const MAX_SELECTED_DOCUMENTS = 4;
const VOICE_PREFERENCE_KEY = 'sv_ai_read_aloud_voice';

export function AIPage() {
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<string[] | null>(null);
  const [providerError, setProviderError] = useState('');
  const [providerRefresh, setProviderRefresh] = useState(0);
  const [topicId, setTopicId] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [shareDocumentsWithProvider, setShareDocumentsWithProvider] = useState(false);
  const [localPractice, setLocalPractice] = useState<ReturnType<typeof buildLocalPracticePrompt> | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);
  const { data: topicResult } = useAllTopics();
  const saveTopicNotes = useSaveTopicNotes();
  const [saveStatus, setSaveStatus] = useState('');
  const [savedAnswers, setSavedAnswers] = useState<string[]>([]);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechVoiceURI, setSpeechVoiceURI] = useState(() => {
    try { return localStorage.getItem(VOICE_PREFERENCE_KEY) ?? ''; } catch { return ''; }
  });
  const [readingTurn, setReadingTurn] = useState<number | null>(null);
  const savingAnswer = useRef(false);
  const selectedTopic = topicResult?.topics.find((topic) => topic.id === topicId);
  const { data: resourceResult, isPending: resourcesLoading } = useResources(topicId || undefined, Boolean(topicId));
  const topicResources = useMemo(
    () => resourceResult?.resources.filter((resource) => resource.topicId === topicId) ?? [],
    [resourceResult?.resources, topicId],
  );
  const availableResourceIds = useMemo(() => new Set(topicResources.map((resource) => resource.id)), [topicResources]);
  const activeResourceIds = selectedResourceIds.filter((id) => availableResourceIds.has(id));
  const transcript = useRef<HTMLDivElement>(null);
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const availableSpeechVoiceURI = speechVoices.some((voice) => voice.voiceURI === speechVoiceURI) ? speechVoiceURI : '';

  useEffect(() => {
    if (!speechAvailable) return;
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [speechAvailable]);

  function chooseSpeechVoice(voiceURI: string) {
    setSpeechVoiceURI(voiceURI);
    try {
      if (voiceURI) localStorage.setItem(VOICE_PREFERENCE_KEY, voiceURI);
      else localStorage.removeItem(VOICE_PREFERENCE_KEY);
    } catch { /* speech remains usable without saved preferences */ }
  }

  function readAnswer(index: number, content: string) {
    if (!speechAvailable) return;
    if (readingTurn === index) {
      window.speechSynthesis.cancel();
      setReadingTurn(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.voice = speechVoices.find((voice) => voice.voiceURI === speechVoiceURI) ?? null;
    utterance.lang = utterance.voice?.lang || navigator.language || 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setReadingTurn(null);
    utterance.onerror = () => setReadingTurn(null);
    window.speechSynthesis.speak(utterance);
    setReadingTurn(index);
  }

  useEffect(() => {
    let active = true;
    aiApi.providers().then((result) => { if (active) setProviders(result.providers); })
      .catch((error: { status?: number }) => {
        if (!active) return;
        if (error?.status === 401) {
          setProviders([]);
          setProviderError('Sign in with a student account to use hosted AI when available. The guest workspace can help you plan a review using your own notes.');
        } else setProviderError('The study service is unavailable right now. Try again in a moment.');
      });
    return () => { active = false; };
  }, [providerRefresh]);
  useEffect(() => {
    const element = transcript.current;
    if (element && typeof element.scrollTo === 'function') element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  function toggleResource(resourceId: string, checked: boolean) {
    setSelectedResourceIds((current) => {
      if (!checked) return current.filter((id) => id !== resourceId);
      if (current.includes(resourceId) || current.length >= MAX_SELECTED_DOCUMENTS) return current;
      return [...current, resourceId];
    });
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || busy) return;
    const updated: Turn[] = [...turns, { role: 'user', content }];
    setTurns(updated); setPrompt(''); setError(''); setBusy(true);
    try {
      if (activeResourceIds.length > 0) {
        const study = await aiApi.study({ question: content, resourceIds: activeResourceIds, shareWithProvider: shareDocumentsWithProvider });
        setTurns((current) => [...current, { role: 'assistant', content: study.answer, study }]);
      } else if (providers?.length === 0) {
        setTurns((current) => [...current, { role: 'assistant', content: buildOfflineStudyGuide(selectedTopic), offline: true }]);
      } else {
        const messages: AIMessage[] = [createSystemPrompt(selectedTopic?.subject, selectedTopic?.title), ...updated.map((turn) => ({ role: turn.role, content: turn.content }))];
        const response = await aiApi.chat({ messages, maxTokens: 2400 });
        setTurns((current) => [...current, { role: 'assistant', content: response.content }]);
      }
    } catch (e) {
      setTurns((current) => current.slice(0, -1));
      setPrompt(content);
      setError((e as Error).message || 'The study request failed. Your question is ready to retry.');
    } finally { setBusy(false); }
  }

  async function saveAnswer(index: number, answer: string) {
    if (!selectedTopic || savingAnswer.current) return;
    const destination = selectedTopic;
    const key = `${destination.id}:${index}`;
    if (savedAnswers.includes(key)) return;
    savingAnswer.current = true;
    setSaveStatus('');
    try {
      const latest = await getTopic(destination.id);
      const question = turns[index - 1]?.content;
      const entry = ['AI study notes (review before relying)', question, answer].filter(Boolean).join('\n\n');
      await saveTopicNotes.mutateAsync({ id: destination.id, notes: [latest.notes, entry].filter(Boolean).join('\n\n---\n\n') });
      setSavedAnswers(current => [...current, key]);
      setSaveStatus(`Added to your notes for ${destination.title}.`);
    } catch {
      setSaveStatus('Could not save this answer. It is still in your conversation.');
    } finally {
      savingAnswer.current = false;
    }
  }

  return (
    <PageContainer><ContentWrapper className="sv-ai-workspace">
      <header className="mb-5"><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">AI Study</p><h1 className="mt-1 text-3xl font-bold text-ink">Your study companion</h1><p className="mt-2 max-w-3xl text-sm text-ink-muted">A polite, patient study partner that follows your conversation. Choose a topic or select course files for cited, document-grounded help. Your files stay on Student-Valut unless you allow provider sharing.</p></header>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900"><Sparkles className="h-4 w-4" aria-hidden="true"/><span>{providers?.length ? `Available providers: ${providers.join(', ')}` : providerError ? 'Provider availability could not be checked.' : 'Checking configured providers…'}</span></div>
      {speechAvailable && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted"><label htmlFor="study-voice">Read answers aloud<select id="study-voice" value={availableSpeechVoiceURI} onChange={(event) => chooseSpeechVoice(event.target.value)} className="ml-2 min-h-9 rounded-md border border-gray-300 bg-white px-2 text-ink"><option value="">Device default</option>{speechVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{/harry/i.test(voice.name) ? 'Harry · male' : /jenni|jenny/i.test(voice.name) ? 'Jenni · female' : `${voice.name}${voice.lang ? ` · ${voice.lang}` : ''}`}</option>)}</select></label><span>Uses voices available on this device; audio stays in your browser.</span></div>}
      {providers?.length === 0 && !providerError && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No AI chat provider is configured. Local document extraction and an offline study scaffold remain available.</p>}

      {selectedTopic && <Card elevation={1} padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">Practice locally: {selectedTopic.subject} — {selectedTopic.title}</h2><p className="text-sm text-ink-muted">Uses your saved notes only in this browser; it does not call an AI provider.</p></div><Button variant="outline" onClick={() => { setLocalPractice(buildLocalPracticePrompt(selectedTopic)); setRevealedHints(0); }}>Create practice prompt</Button></div>
        {localPractice && <div className="mt-3 rounded-lg bg-gray-50 p-3"><p className="text-sm font-medium text-ink">{localPractice.prompt}</p>{revealedHints > 0 && <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-ink-muted">{localPractice.hints.slice(0, revealedHints).map((hint, index) => <li key={index}>Hint {index + 1}: {hint}</li>)}</ol>}<Button className="mt-3" size="sm" variant="ghost" disabled={revealedHints >= localPractice.hints.length} onClick={() => setRevealedHints((count) => Math.min(count + 1, localPractice.hints.length))}>{revealedHints >= localPractice.hints.length ? 'All hints revealed' : 'Reveal next hint'}</Button></div>}
        <div className="mt-4 border-t border-gray-200 pt-3">
          <h3 className="text-sm font-semibold text-ink">Select sources for this topic</h3>
          {resourcesLoading ? <p role="status" className="mt-1 text-xs text-ink-muted">Loading resources…</p> : topicResources.length ? <ul className="mt-2 space-y-2">{topicResources.map((resource) => {
            const supported = resource.mimeType === 'application/pdf' || ['image/jpeg', 'image/png', 'image/webp'].includes(resource.mimeType);
            const checked = activeResourceIds.includes(resource.id);
            return <li key={resource.id} className="flex items-start gap-2 text-sm"><input id={`study-resource-${resource.id}`} type="checkbox" checked={checked} disabled={!supported || (!checked && activeResourceIds.length >= MAX_SELECTED_DOCUMENTS)} onChange={(event) => toggleResource(resource.id, event.target.checked)} className="mt-1"/><label htmlFor={`study-resource-${resource.id}`} className="min-w-0"><span className="font-medium text-ink">{resource.name}</span><span className="ml-2 text-xs text-ink-muted">{resource.mimeType === 'application/pdf' ? 'PDF text extracted on the Student-Vault server' : supported ? 'Image OCR requires external consent' : 'Unsupported for text extraction'}</span></label>{resource.downloadUrl || resource.data ? <a className="ml-auto text-xs underline" href={resource.downloadUrl || resource.data || undefined} target="_blank" rel="noreferrer">Open</a> : null}</li>;
          })}</ul> : <p className="mt-1 text-xs text-ink-muted">No resources are linked to this topic.</p>}
          {activeResourceIds.some((id) => topicResources.find((resource) => resource.id === id)?.mimeType.startsWith('image/')) && <p className="mt-2 text-xs text-amber-800">Image OCR sends the selected image to the configured OCR provider. It stays off unless you enable external sharing.</p>}
          <label className="mt-3 flex items-start gap-2 rounded bg-gray-50 p-3 text-sm text-ink"><input type="checkbox" checked={shareDocumentsWithProvider} onChange={(event) => setShareDocumentsWithProvider(event.target.checked)} className="mt-1"/><span><span className="font-medium">Allow selected sources to be sent to configured AI/OCR providers</span><span className="mt-1 block text-xs text-ink-muted">Off by default. PDFs are parsed on the Student-Vault server; when enabled, retrieved excerpts are sent to the AI chat provider. Selected images may be sent to the configured OCR provider first.</span></span></label>
          <p className="mt-2 text-xs text-ink-muted">Select up to {MAX_SELECTED_DOCUMENTS} files. Unsupported, encrypted, malformed, image-only, or unavailable resources are reported without being presented as evidence.</p>
        </div>
      </Card>}

      <Card elevation={1} padding="md" className="mt-4 flex min-h-[60vh] flex-col">
        <div ref={transcript} className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-3" aria-live="polite" aria-label="Conversation">
          {turns.length === 0 && <div className="mx-auto max-w-md py-12 text-center text-ink-muted"><MessageSquare className="mx-auto mb-3 h-8 w-8" aria-hidden="true"/><p className="font-medium text-ink">What are you studying today?</p><p className="mt-1 text-sm">Choose a topic and optional sources, or ask a general question. Documents stay local unless you enable external sharing.</p></div>}
          {turns.map((turn, index) => <div key={`${index}-${turn.role}`} className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${turn.role === 'user' ? 'ml-auto bg-teal-700 text-white' : 'bg-white text-ink shadow-sm'}`}>
            <p className="mb-1 text-xs font-semibold opacity-75">{turn.role === 'user' ? 'You' : turn.offline ? 'Local review guide' : turn.study?.mode === 'provider_grounded' ? `AI answer · retrieved evidence sent to ${turn.study.provider}` : turn.study ? 'Retrieved excerpts · no AI answer' : 'AI study notes · review before relying'}</p>
            <p>{turn.content}</p>
            {turn.role === 'assistant' && !turn.offline && speechAvailable && <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => readAnswer(index, turn.content)}>{readingTurn === index ? 'Stop reading' : 'Read aloud'}</Button>}
            {turn.role === 'assistant' && !turn.offline && (!turn.study || turn.study.mode === 'provider_grounded') && selectedTopic && (
              <Button size="sm" variant="outline" className="mt-3"
                disabled={saveTopicNotes.isPending || savedAnswers.includes(`${selectedTopic.id}:${index}`)}
                onClick={() => void saveAnswer(index, turn.content)}>
                {savedAnswers.includes(`${selectedTopic.id}:${index}`) ? 'Saved to notes' : `Add to notes for ${selectedTopic.title}`}
              </Button>
            )}
            {turn.study && <div className="mt-3 border-t border-gray-200 pt-2 text-xs text-ink-muted"><p>{turn.study.notice}</p>{turn.study.extractionProviders.length > 0 && <p className="mt-1">External extraction: {turn.study.extractionProviders.join(', ')}</p>}{turn.study.sources.length > 0 && <div className="mt-2"><p className="font-semibold text-ink">Retrieved passages</p><ul className="mt-1 space-y-2">{turn.study.sources.map((source, sourceIndex) => <li key={`${source.resourceId}-${source.page}-${sourceIndex}`} className="rounded bg-gray-50 p-2"><p className="font-medium">{source.title} · page {source.page}</p><p className="mt-1">{source.text}</p></li>)}</ul></div>}{turn.study.sourceErrors.length > 0 && <ul className="mt-2 list-inside list-disc">{turn.study.sourceErrors.map((source) => <li key={source.resourceId}>{source.title}: {source.error.replaceAll('_', ' ')}</li>)}</ul>}</div>}
          </div>)}
          {busy && <p role="status" className="text-sm text-ink-muted">Retrieving selected sources…</p>}
        </div>
        {error && <p role="alert" className="mb-3 rounded-lg bg-coral-50 p-3 text-sm text-coral-800">{error}</p>}
        {saveStatus && <p role="status" className="mb-3 text-sm text-ink-muted">{saveStatus}</p>}
        {providerError && <div className="mb-3 rounded-lg border border-border p-3 text-sm text-ink-muted" role="status"><p>{providerError}</p><Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { setProviderError(''); setProviders(null); setProviderRefresh(value => value + 1); }}>Check service again</Button></div>}
        <div className="mb-3"><label className="text-sm text-ink-muted">Study topic<select value={topicId} onChange={(event) => { setTopicId(event.target.value); setSelectedResourceIds([]); }} className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-ink"><option value="">No topic selected</option>{topicResult?.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subject}: {topic.title}</option>)}</select></label></div>
        <form onSubmit={send} className="flex items-end gap-2"><label htmlFor="ai-question" className="sr-only">Your study question</label><textarea id="ai-question" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={2} className="min-h-12 min-w-0 flex-1 resize-y rounded-lg border border-gray-300 p-3 text-sm" placeholder="Ask a study question…"/><Button type="submit" loading={busy} disabled={!prompt.trim() || busy || (providers === null && !providerError)} aria-label="Send question" leftIcon={<Send className="h-4 w-4"/>}>Send</Button></form>
      </Card>
    </ContentWrapper></PageContainer>
  );
}
