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

export function createSystemPrompt(subject?: string): AIMessage {
  return {
    role: 'system',
    content: `You are a helpful study assistant for students. ${
      subject ? `The current subject is "${subject}". ` : ''
    }Provide clear, concise explanations. Use examples when helpful. 
    Encourage active learning by asking follow-up questions. Keep responses focused and practical.`,
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