/**
 * YouTube Service Interface
 * Provides access to YouTube Data API v3
 */

import { google, youtube_v3 } from "googleapis";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  embedUrl: string;
}

export interface YouTubeSearchOptions {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "rating" | "viewCount" | "title";
  type?: "video" | "channel" | "playlist";
  videoDuration?: "any" | "short" | "medium" | "long";
  videoDefinition?: "any" | "high" | "standard";
  safeSearch?: "none" | "moderate" | "strict";
}

export interface YouTubeSearchResponse {
  videos: YouTubeVideo[];
  nextPageToken?: string;
  totalResults: number;
}

export interface YouTubeProvider {
  search(options: YouTubeSearchOptions): Promise<YouTubeSearchResponse>;
  getVideo(id: string): Promise<YouTubeVideo | null>;
}

export class YouTubeService {
  private provider: YouTubeProvider | null = null;

  setProvider(provider: YouTubeProvider): void {
    this.provider = provider;
  }

  getProvider(): YouTubeProvider {
    if (!this.provider) {
      throw new Error("YouTube provider not configured");
    }
    return this.provider;
  }

  async search(options: YouTubeSearchOptions): Promise<YouTubeSearchResponse> {
    return this.getProvider().search(options);
  }

  async getVideo(id: string): Promise<YouTubeVideo | null> {
    return this.getProvider().getVideo(id);
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }
}

export const youtubeService = new YouTubeService();

/**
 * Placeholder provider - used as fallback when no API key is configured
 */
export class PlaceholderYouTubeProvider implements YouTubeProvider {
  async search(_options: YouTubeSearchOptions): Promise<YouTubeSearchResponse> {
    return {
      videos: [],
      totalResults: 0,
    };
  }

  async getVideo(_id: string): Promise<YouTubeVideo | null> {
    return null;
  }
}

/**
 * YouTube Data API v3 Provider Implementation
 */
export class YouTubeDataApiProvider implements YouTubeProvider {
  private youtube: youtube_v3.Youtube;

  constructor(apiKey: string) {
    this.youtube = google.youtube({
      version: "v3",
      auth: apiKey,
    });
  }

  private parseDuration(isoDuration: string): string {
    // Parse ISO 8601 duration (PT#H#M#S) to readable format
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return isoDuration;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  private mapVideo(item: youtube_v3.Schema$Video): YouTubeVideo {
    return {
      id: item.id || "",
      title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "",
      channelTitle: item.snippet?.channelTitle || "",
      publishedAt: item.snippet?.publishedAt || "",
      duration: item.contentDetails?.duration ? this.parseDuration(item.contentDetails.duration) : "0:00",
      viewCount: parseInt(item.statistics?.viewCount || "0", 10),
      embedUrl: `https://www.youtube.com/embed/${item.id}`,
    };
  }

  async search(options: YouTubeSearchOptions): Promise<YouTubeSearchResponse> {
    const {
      query,
      maxResults = 10,
      order = "relevance",
      type = "video",
      videoDuration,
      videoDefinition,
      safeSearch = "moderate",
    } = options;

    const searchResponse = await this.youtube.search.list({
      part: ["id", "snippet"],
      q: query,
      maxResults: Math.min(maxResults, 50),
      order,
      type: [type],
      videoDuration,
      videoDefinition,
      safeSearch,
    });

    const videoIds = searchResponse.data.items
      ?.map((item) => item.id?.videoId)
      .filter((id): id is string => !!id) || [];

    if (videoIds.length === 0) {
      return {
        videos: [],
        nextPageToken: searchResponse.data.nextPageToken || undefined,
        totalResults: searchResponse.data.pageInfo?.totalResults || 0,
      };
    }

    // Get detailed video info (statistics, contentDetails)
    const videosResponse = await this.youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: videoIds,
    });

    const videos = videosResponse.data.items?.map((item) => this.mapVideo(item)) || [];

    return {
      videos,
      nextPageToken: searchResponse.data.nextPageToken || undefined,
      totalResults: searchResponse.data.pageInfo?.totalResults || 0,
    };
  }

  async getVideo(id: string): Promise<YouTubeVideo | null> {
    const response = await this.youtube.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: [id],
    });

    const item = response.data.items?.[0];
    if (!item) return null;

    return this.mapVideo(item);
  }
}

/**
 * Initialize YouTube provider from environment variable
 */
export async function initializeYouTubeProvider(): Promise<void> {
  const { getEnv } = await import("../config/env.js");
  const env = getEnv();

  if (env.YOUTUBE_API_KEY) {
    const provider = new YouTubeDataApiProvider(env.YOUTUBE_API_KEY);
    youtubeService.setProvider(provider);
  } else {
    // Fallback to placeholder if no API key
    youtubeService.setProvider(new PlaceholderYouTubeProvider());
  }
}