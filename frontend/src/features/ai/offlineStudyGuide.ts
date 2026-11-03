import type { Topic } from '../../types/api';

/** Local-only scaffold. It does not answer factual questions or call an external provider. */
export function buildOfflineStudyGuide(topic: Pick<Topic, 'subject' | 'title' | 'notes'> | undefined): string {
  const heading = topic ? `${topic.subject} — ${topic.title}` : 'No topic selected';
  const notes = topic?.notes.trim();
  const excerpt = notes ? `\n\nYour saved notes begin: “${notes.slice(0, 800)}${notes.length > 800 ? '…' : ''}”` : '';
  return `Offline study scaffold (no AI provider configured). Topic: ${heading}.${excerpt}\n\nTry this sequence:\n1. Write what you remember without looking at your notes.\n2. Compare your explanation with the notes and mark one uncertain point.\n3. Explain that point in your own words.\n4. Make a new example and solve it to check your understanding.\n\nThis local scaffold has not generated or verified an answer to your question.`;
}

export function buildLocalPracticePrompt(topic: Pick<Topic, 'subject' | 'title' | 'notes'>): { prompt: string; hints: string[] } {
  const excerpt = topic.notes.trim().split(/[.!?\n]/).find((sentence) => sentence.trim().length > 12)?.trim();
  return {
    prompt: excerpt
      ? `Explain this idea from your saved notes in your own words: “${excerpt.slice(0, 400)}${excerpt.length > 400 ? '…' : ''}”`
      : `For ${topic.subject} — ${topic.title}, write a definition, give one example, and explain why the example fits.`,
    hints: [
      `Name the key idea in ${topic.title} before adding details.`,
      'Connect each term in your explanation to a reason or example.',
      'Check your explanation against your saved notes and revise one unclear part.',
    ],
  };
}
