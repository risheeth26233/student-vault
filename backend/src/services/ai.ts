/**
 * AI Service Interface
 * Provides a unified interface for different AI providers (OpenAI, Anthropic)
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  name: string;
  chat(options: AIChatOptions): Promise<AIChatResponse>;
  chatStream(options: AIChatOptions): AsyncIterable<string>;
  embed(texts: string[]): Promise<number[][]>;
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string | null = null;

  registerProvider(name: string, provider: AIProvider, setAsDefault = false): void {
    this.providers.set(name, provider);
    if (setAsDefault || !this.defaultProvider) {
      this.defaultProvider = name;
    }
  }

  getProvider(name?: string): AIProvider {
    const providerName = name || this.defaultProvider;
    if (!providerName) {
      throw new Error("No AI provider configured");
    }
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`AI provider "${providerName}" not found`);
    }
    return provider;
  }

  async chat(options: AIChatOptions, providerName?: string): Promise<AIChatResponse> {
    return this.getProvider(providerName).chat(options);
  }

  async *chatStream(options: AIChatOptions, providerName?: string): AsyncIterable<string> {
    yield* this.getProvider(providerName).chatStream(options);
  }

  async embed(texts: string[], providerName?: string): Promise<number[][]> {
    return this.getProvider(providerName).embed(texts);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const aiService = new AIService();

/**
 * Placeholder provider - used as fallback when no real provider is configured
 */
export class PlaceholderAIProvider implements AIProvider {
  name = "placeholder";

  async chat(_options: AIChatOptions): Promise<AIChatResponse> {
    return {
      content: "[AI Response Placeholder] This feature will be implemented in Phase 4.",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async *chatStream(_options: AIChatOptions): AsyncIterable<string> {
    yield "[Streaming Placeholder] ";
    yield "This feature will be implemented in Phase 4.";
  }

  async embed(_texts: string[]): Promise<number[][]> {
    return _texts.map(() => new Array(1536).fill(0));
  }
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;
  private defaultModel = "gpt-4o-mini";
  private embeddingModel = "text-embedding-3-small";

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.model || this.defaultModel;
    const response = await this.client.chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: false,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *chatStream(options: AIChatOptions): AsyncIterable<string> {
    const model = options.model || this.defaultModel;
    const stream = await this.client.chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}

/**
 * Anthropic Provider Implementation
 */
export class AnthropicProvider implements AIProvider {
  name = "anthropic";
  private client: Anthropic;
  private defaultModel = "claude-3-5-sonnet-20241022";

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.model || this.defaultModel;
    const systemMessage = options.messages.find((m) => m.role === "system");
    const messages = options.messages.filter((m) => m.role !== "system");

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const content = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");

    return {
      content,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *chatStream(options: AIChatOptions): AsyncIterable<string> {
    const model = options.model || this.defaultModel;
    const systemMessage = options.messages.find((m) => m.role === "system");
    const messages = options.messages.filter((m) => m.role !== "system");

    const stream = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        yield chunk.delta.text;
      }
    }
  }

  async embed(_texts: string[]): Promise<number[][]> {
    // Anthropic doesn't provide embeddings API yet
    // Return zero vectors as fallback
    return _texts.map(() => new Array(1536).fill(0));
  }
}

/**
 * Initialize AI providers from environment variables
 */
export async function initializeAIProviders(): Promise<void> {
  const { getEnv } = await import("../config/env.js");
  const env = getEnv();

  // Register OpenAI provider if API key is available
  if (env.OPENAI_API_KEY) {
    const openaiProvider = new OpenAIProvider(env.OPENAI_API_KEY);
    aiService.registerProvider("openai", openaiProvider, true);
  }

  // Register Anthropic provider if API key is available
  if (env.ANTHROPIC_API_KEY) {
    const anthropicProvider = new AnthropicProvider(env.ANTHROPIC_API_KEY);
    // Only set as default if OpenAI wasn't registered
    const setAsDefault = !env.OPENAI_API_KEY;
    aiService.registerProvider("anthropic", anthropicProvider, setAsDefault);
  }

  // If no real providers configured, register placeholder
  if (aiService.listProviders().length === 0) {
    aiService.registerProvider("placeholder", new PlaceholderAIProvider(), true);
  }
}