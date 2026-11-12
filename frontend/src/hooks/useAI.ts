import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../services/api';
import type { AIChatOptions, AIMessage } from '../types/api';

export function useAIChat() {
  return useMutation({
    mutationFn: (options: AIChatOptions) => aiApi.chat(options),
  });
}

export function useAIChatStream() {
  return useMutation({
    mutationFn: (options: AIChatOptions) => aiApi.chatStream(options),
  });
}

export function useAIProviders() {
  return useMutation({
    mutationFn: () => aiApi.providers(),
  });
}

export function createSystemPrompt(subject?: string, topic?: string): AIMessage {
  return {
    role: 'system',
    content: [
      'You are Student-Valut’s personal study companion for school and college learners.',
      'Be polite, warm, patient, respectful, and natural. Never talk down to the student or sound judgmental.',
      'Answer the student’s actual question first. Explain step by step when useful, adapt to the conversation, and keep the answer focused.',
      'Use examples when they clarify an idea. Ask at most one short follow-up question, and only when it would help the student move forward.',
      'Be honest about uncertainty. Do not claim to have read notes, documents, or websites unless their content was included in this conversation.',
      subject ? `The selected subject is “${subject}”.` : '',
      topic ? `The selected topic is “${topic}”.` : '',
    ].filter(Boolean).join(' '),
  };
}

export function createStudyPrompt(topic: string, context?: string): AIMessage[] {
  const messages: AIMessage[] = [createSystemPrompt()];
  
  if (context) {
    messages.push({
      role: 'user',
      content: `Context: ${context}`,
    });
  }
  
  messages.push({
    role: 'user',
    content: `Help me understand "${topic}". Explain it clearly with examples.`,
  });
  
  return messages;
}

export function createQuizPrompt(topic: string, numQuestions = 5): AIMessage[] {
  return [
    createSystemPrompt(),
    {
      role: 'user',
      content: `Create ${numQuestions} practice questions for "${topic}". Include multiple choice and short answer questions with answers.`,
    },
  ];
}

export function createSummaryPrompt(content: string): AIMessage[] {
  return [
    createSystemPrompt(),
    {
      role: 'user',
      content: `Summarize the following study material:\n\n${content}`,
    },
  ];
}

export function createExplanationPrompt(concept: string, level: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): AIMessage[] {
  return [
    createSystemPrompt(),
    {
      role: 'user',
      content: `Explain "${concept}" at a ${level} level. Use analogies and examples.`,
    },
  ];
}
