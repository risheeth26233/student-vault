/**
 * Image Generation Service Interface
 * Provides access to image generation APIs (Fal.ai, DALL-E, etc.)
 */

import OpenAI from "openai";
import { fal } from "@fal-ai/client";

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  model?: string;
  format?: "png" | "jpeg" | "webp";
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  prompt: string;
  seed: number;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
  creditsUsed?: number;
}

export interface ImageProvider {
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResponse>;
}

export class ImageService {
  private provider: ImageProvider | null = null;

  setProvider(provider: ImageProvider): void {
    this.provider = provider;
  }

  getProvider(): ImageProvider {
    if (!this.provider) {
      throw new Error("Image provider not configured");
    }
    return this.provider;
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    return this.getProvider().generate(options);
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }
}

export const imageService = new ImageService();

/**
 * Placeholder provider - used as fallback when no API key is configured
 */
export class PlaceholderImageProvider implements ImageProvider {
  async generate(_options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    return {
      images: [],
      creditsUsed: 0,
    };
  }
}

/**
 * Fal.ai Provider Implementation
 * Supports various models like Flux, SDXL, etc.
 */
export class FalAiProvider implements ImageProvider {
  name = "fal-ai";
  private client: typeof fal;

  constructor(apiKey: string) {
    this.client = fal;
    this.client.config({
      credentials: apiKey,
    });
  }

  private mapFormat(format?: "png" | "jpeg" | "webp"): string {
    switch (format) {
      case "jpeg":
        return "jpeg";
      case "webp":
        return "webp";
      case "png":
      default:
        return "png";
    }
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const {
      prompt,
      negativePrompt,
      width = 512,
      height = 512,
      steps,
      guidanceScale,
      seed,
      model = "fal-ai/flux/dev", // Default to Flux dev model
      format = "png",
    } = options;

    try {
      const modelToUse = model.startsWith("fal-ai/") ? model : `fal-ai/${model}`;
      
      const input: Record<string, unknown> = {
        prompt,
        image_size: {
          width,
          height,
        },
        format: this.mapFormat(format),
      };

      if (negativePrompt) {
        input.negative_prompt = negativePrompt;
      }
      if (steps !== undefined) {
        input.num_inference_steps = steps;
      }
      if (guidanceScale !== undefined) {
        input.guidance_scale = guidanceScale;
      }
      if (seed !== undefined) {
        input.seed = seed;
      }

      const result = await this.client.subscribe(modelToUse, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            // Could emit progress here if needed
          }
        },
      });

      interface FalImage {
      url: string;
      width?: number;
      height?: number;
      seed?: number;
    }

      const images: GeneratedImage[] = (result.data.images || []).map((img: FalImage) => ({
        url: img.url,
        width: img.width || width,
        height: img.height || height,
        prompt,
        seed: img.seed || Math.floor(Math.random() * 1000000),
      }));

      return {
        images,
        creditsUsed: result.data.credits_used,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("unauthorized")) {
          throw new Error("Invalid Fal.ai API key");
        }
        if (error.message.includes("429") || error.message.includes("rate limit")) {
          throw new Error("Fal.ai API rate limit exceeded");
        }
        if (error.message.includes("timeout") || error.message.includes("timed out")) {
          throw new Error("Fal.ai API request timed out");
        }
        throw new Error(`Fal.ai API error: ${error.message}`);
      }
      throw new Error("Unknown error during Fal.ai image generation");
    }
  }
}

/**
 * OpenAI DALL-E Provider Implementation
 * Supports DALL-E 2 and DALL-E 3
 */
export class OpenAIImageProvider implements ImageProvider {
  name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private mapFormat(format?: "png" | "jpeg" | "webp"): "png" | "jpeg" | "webp" {
    // DALL-E only supports png, jpeg, webp
    switch (format) {
      case "jpeg":
        return "jpeg";
      case "webp":
        return "webp";
      case "png":
      default:
        return "png";
    }
  }

  private mapModel(model?: string): "dall-e-2" | "dall-e-3" {
    if (model && model.includes("3")) {
      return "dall-e-3";
    }
    return "dall-e-2";
  }

  private mapSize(width: number, height: number, model: "dall-e-2" | "dall-e-3"): string {
    // DALL-E 2 supports: 256x256, 512x512, 1024x1024
    // DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
    const min = Math.min(width, height);
    const isPortrait = height > width;
    const isLandscape = width > height;

    if (model === "dall-e-3") {
      if (isPortrait && height >= 1792) return "1024x1792";
      if (isLandscape && width >= 1792) return "1792x1024";
      return "1024x1024";
    }

    // DALL-E 2
    if (min <= 256) return "256x256";
    if (min <= 512) return "512x512";
    return "1024x1024";
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const {
      prompt,
      // negativePrompt, // Not supported by DALL-E
      width = 512,
      height = 512,
      // steps, // Not supported by DALL-E
      // guidanceScale, // Not supported by DALL-E
      seed, // Not supported by DALL-E, but used for response metadata
      model = "dall-e-2",
      // format = "png", // Response format handled by API
    } = options;

    try {
      const modelToUse = this.mapModel(model);
      const size = this.mapSize(width, height, modelToUse);

      const response = await this.client.images.generate({
        model: modelToUse,
        prompt,
        n: 1, // DALL-E generates one image at a time
        size: size as "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792",
        response_format: "url",
        quality: modelToUse === "dall-e-3" ? "standard" : undefined,
      });

      const images: GeneratedImage[] = (response.data || []).map((img, _index) => ({
        url: img.url || "",
        width: width,
        height: height,
        prompt,
        seed: seed || Math.floor(Math.random() * 1000000),
      }));

      return {
        images,
        creditsUsed: undefined, // OpenAI doesn't return credits used
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("unauthorized")) {
          throw new Error("Invalid OpenAI API key");
        }
        if (error.message.includes("429") || error.message.includes("rate limit")) {
          throw new Error("OpenAI API rate limit exceeded");
        }
        if (error.message.includes("timeout") || error.message.includes("timed out")) {
          throw new Error("OpenAI API request timed out");
        }
        throw new Error(`OpenAI DALL-E API error: ${error.message}`);
      }
      throw new Error("Unknown error during OpenAI image generation");
    }
  }
}

/**
 * Initialize Image providers from environment variables
 * Priority: Fal.ai > OpenAI DALL-E > Placeholder
 */
export async function initializeImageProvider(): Promise<void> {
  const { getEnv } = await import("../config/env.js");
  const env = getEnv();

  // Try Fal.ai first (recommended for better quality/control)
  if (env.FAL_API_KEY) {
    const provider = new FalAiProvider(env.FAL_API_KEY);
    imageService.setProvider(provider);
    return;
  }

  // Fallback to OpenAI DALL-E
  if (env.OPENAI_API_KEY) {
    const provider = new OpenAIImageProvider(env.OPENAI_API_KEY);
    imageService.setProvider(provider);
    return;
  }

  // Fallback to placeholder if no API key
  imageService.setProvider(new PlaceholderImageProvider());
}