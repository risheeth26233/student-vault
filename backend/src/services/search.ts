/**
 * Web Search Service Interface
 * Provides access to web search APIs (Brave Search, etc.)
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  safeSearch?: "off" | "moderate" | "strict";
  freshness?: "day" | "week" | "month" | "year";
  language?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

export interface SearchProvider {
  search(options: SearchOptions): Promise<SearchResponse>;
}

export class SearchService {
  private provider: SearchProvider | null = null;

  setProvider(provider: SearchProvider): void {
    this.provider = provider;
  }

  getProvider(): SearchProvider {
    if (!this.provider) {
      throw new Error("Search provider not configured");
    }
    return this.provider;
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    return this.getProvider().search(options);
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }
}

export const searchService = new SearchService();

/**
 * Placeholder provider - used as fallback when no API key is configured
 */
export class PlaceholderSearchProvider implements SearchProvider {
  async search(options: SearchOptions): Promise<SearchResponse> {
    return {
      results: [],
      query: options.query,
      totalResults: 0,
    };
  }
}

/**
 * Brave Search API Provider Implementation
 * Uses the Brave Search API (https://api.search.brave.com/res/v1/web/search)
 */
export class BraveSearchProvider implements SearchProvider {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1/web/search";
  private timeout = 10000; // 10 second timeout

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private mapSafeSearch(safeSearch?: "off" | "moderate" | "strict"): string {
    switch (safeSearch) {
      case "off":
        return "off";
      case "strict":
        return "strict";
      case "moderate":
      default:
        return "moderate";
    }
  }

  private mapFreshness(freshness?: "day" | "week" | "month" | "year"): string | undefined {
    switch (freshness) {
      case "day":
        return "pd";
      case "week":
        return "pw";
      case "month":
        return "pm";
      case "year":
        return "py";
      default:
        return undefined;
    }
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    const {
      query,
      maxResults = 10,
      safeSearch = "moderate",
      freshness,
      language,
    } = options;

    const params = new URLSearchParams({
      q: query,
      count: Math.min(maxResults, 20).toString(), // Brave API max is 20
      safesearch: this.mapSafeSearch(safeSearch),
    });

    if (freshness) {
      params.append("freshness", this.mapFreshness(freshness)!);
    }

    if (language) {
      params.append("lang", language);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid Brave Search API key");
        }
        if (response.status === 429) {
          throw new Error("Brave Search API rate limit exceeded");
        }
        const errorText = await response.text().catch(() => "");
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as {
        web?: {
          results?: Array<{
            title?: string;
            url?: string;
            description?: string;
            snippet?: string;
            profile?: { name?: string };
            age?: string;
          }>;
          totalResults?: number;
        };
      };

      // Map Brave Search results to our interface
      const results: SearchResult[] = (data.web?.results || []).map((item) => ({
        title: item.title || "",
        url: item.url || "",
        snippet: item.description || item.snippet || "",
        source: item.profile?.name || "Brave Search",
        publishedAt: item.age ? new Date(Date.now() - this.parseAgeToMs(item.age)).toISOString() : undefined,
      }));

      return {
        results,
        query,
        totalResults: data.web?.totalResults || results.length,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Brave Search API request timed out");
        }
        // Re-throw known errors
        if (error.message.includes("Invalid Brave Search API key") ||
            error.message.includes("rate limit") ||
            error.message.includes("timed out")) {
          throw error;
        }
        // Network/unknown errors
        throw new Error(`Brave Search API request failed: ${error.message}`);
      }
      throw new Error("Unknown error during Brave Search API request");
    }
  }

  private parseAgeToMs(age: string): number {
    // Parse age strings like "2 hours ago", "3 days ago", "1 week ago"
    const match = age.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || 0);
  }
}

/**
 * Initialize Search provider from environment variable
 */
export async function initializeSearchProvider(): Promise<void> {
  const { getEnv } = await import("../config/env.js");
  const env = getEnv();

  if (env.BRAVE_SEARCH_API_KEY) {
    const provider = new BraveSearchProvider(env.BRAVE_SEARCH_API_KEY);
    searchService.setProvider(provider);
  } else {
    // Fallback to placeholder if no API key
    searchService.setProvider(new PlaceholderSearchProvider());
  }
}