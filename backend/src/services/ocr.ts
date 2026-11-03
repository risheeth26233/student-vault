/**
 * Handwritten-work OCR service (Phase 3).
 *
 * Provider-independent interface: the route layer only ever sees `OcrProvider`,
 * so the extraction engine can be replaced (or disabled) without touching the
 * application. Honesty rules encoded here:
 *
 *  - No configured credentials → the unavailable provider answers every page as
 *    `failed`/`ocr_unavailable`. We never invent text or a fake engine; the
 *    client then falls back to manual transcription.
 *  - `estimatedConfidence` is the PROVIDER'S OWN estimate of how well it read
 *    the page, surfaced to the student as an estimate — not a measurement.
 *  - The prompt transcribes only: it never solves, corrects or completes the
 *    student's work, so later evaluation sees what the student actually wrote.
 *  - Student pages reach an external service only when a provider is explicitly
 *    configured (OCR_PROVIDER / OPENAI_API_KEY) AND the client sent an explicit
 *    consent flag (enforced in routes/handwriting.ts).
 */

import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "../config/env.js";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface OcrPageInput {
  /** Caller-supplied page id — echoed back so multi-page order is preserved. */
  id: string;
  /** Data URL, e.g. `data:image/jpeg;base64,...` (validated by the route). */
  dataUrl: string;
}

export type OcrPageStatus = "ok" | "low_confidence" | "failed";

export interface OcrPageResult {
  id: string;
  status: OcrPageStatus;
  text: string;
  /** Provider self-estimate in 0..1, or null when the provider gave none. */
  estimatedConfidence: number | null;
  /** Ambiguity notes reported by the provider (e.g. unreadable regions). */
  notes: string[];
  /** Machine-readable failure code when status === 'failed'. */
  error?: string;
}

export interface OcrResult {
  provider: string;
  configured: boolean;
  pages: OcrPageResult[];
}

export interface OcrProvider {
  readonly name: string;
  isConfigured(): boolean;
  extract(pages: OcrPageInput[]): Promise<OcrResult>;
}

/** Provider estimates below this are surfaced for mandatory student review. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Unavailable provider — the honest default
// ---------------------------------------------------------------------------

export class UnavailableOcrProvider implements OcrProvider {
  readonly name = "unavailable";

  isConfigured(): boolean {
    return false;
  }

  async extract(pages: OcrPageInput[]): Promise<OcrResult> {
    return {
      provider: this.name,
      configured: false,
      pages: pages.map((page) => ({
        id: page.id,
        status: "failed" as const,
        text: "",
        estimatedConfidence: null,
        notes: [],
        error: "ocr_unavailable",
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI vision provider — a real extraction path when OPENAI_API_KEY exists
// ---------------------------------------------------------------------------

const TRANSCRIBE_SYSTEM_PROMPT = [
  'You transcribe a single page of handwritten student work from an image.',
  'Respond with JSON only: {"text": string, "confidence": number between 0 and 1, "unclear": string[]}.',
  "- Transcribe exactly what is written, preserving line breaks and reading order.",
  "- Preserve the student's spelling, crossings-out and mistakes. Do NOT solve,",
  "  correct, complete or summarise anything — transcription only.",
  "- Write mathematical expressions readably (e.g. x^2 + 2x - 3 = 0, 1/2, sqrt(9)).",
  "- In 'unclear', list short quotes of regions you could not read confidently.",
  "- 'confidence' is your own estimate of how well you read this page (0 = unreadable,",
  "  1 = certain). Omit nothing: always report it.",
].join("\n");

const modelOutputZod = z.object({
  text: z.string(),
  confidence: z.number().optional(),
  unclear: z.array(z.string()).default([]),
});

/** Accepts 0..1 directly and treats 1..100 as a percentage (deterministic). */
function normalizeConfidence(value: number | undefined): number | null {
  if (value === undefined || Number.isNaN(value)) return null;
  const scaled = value > 1 && value <= 100 ? value / 100 : value;
  if (scaled < 0 || scaled > 1) return null;
  return Math.round(scaled * 100) / 100;
}

export class OpenAiVisionOcrProvider implements OcrProvider {
  readonly name = "openai-vision";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
    this.model = model || "gpt-4o-mini";
  }

  isConfigured(): boolean {
    return true;
  }

  async extract(pages: OcrPageInput[]): Promise<OcrResult> {
    const results: OcrPageResult[] = [];
    // Sequential on purpose: preserves page order, avoids burst rate limits.
    for (const page of pages) {
      results.push(await this.extractPage(page));
    }
    return { provider: this.name, configured: true, pages: results };
  }

  private async extractPage(page: OcrPageInput): Promise<OcrPageResult> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TRANSCRIBE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this page of handwritten work." },
              { type: "image_url", image_url: { url: page.dataUrl } },
            ],
          },
        ],
      }, { signal: AbortSignal.timeout(30_000) });

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: z.infer<typeof modelOutputZod>;
      try {
        parsed = modelOutputZod.parse(JSON.parse(raw));
      } catch {
        return {
          id: page.id,
          status: "failed",
          text: "",
          estimatedConfidence: null,
          notes: [],
          error: "invalid_response",
        };
      }

      const text = parsed.text.trim();
      const confidence = normalizeConfidence(parsed.confidence);
      const notes = parsed.unclear.filter((entry) => entry.trim().length > 0);

      if (text.length === 0) {
        return {
          id: page.id,
          status: "failed",
          text: "",
          estimatedConfidence: confidence,
          notes,
          error: "no_text",
        };
      }

      // Fail safe: an unknown confidence, or an ambiguous/low estimate, sends
      // the page to the student for mandatory review before evaluation.
      const low = confidence === null || confidence < LOW_CONFIDENCE_THRESHOLD || notes.length > 0;
      if (low && confidence === null) {
        notes.push("The extraction service did not report a confidence estimate — please review the text.");
      }

      return {
        id: page.id,
        status: low ? "low_confidence" : "ok",
        text,
        estimatedConfidence: confidence,
        notes,
      };
    } catch {
      return {
        id: page.id,
        status: "failed",
        text: "",
        estimatedConfidence: null,
        notes: [],
        error: "provider_error",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Service + initialization (mirrors the images/search provider pattern)
// ---------------------------------------------------------------------------

export class OcrService {
  private provider: OcrProvider = new UnavailableOcrProvider();

  setProvider(provider: OcrProvider): void {
    this.provider = provider;
  }

  getProvider(): OcrProvider {
    return this.provider;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async extract(pages: OcrPageInput[]): Promise<OcrResult> {
    return this.provider.extract(pages);
  }
}

export const ocrService = new OcrService();

/**
 * Select the OCR provider from configuration.
 * - OCR_PROVIDER=none           → forced unavailable (explicit opt-out)
 * - OCR_PROVIDER=openai         → OpenAI vision, but only with a real key
 * - unset                       → OpenAI vision when OPENAI_API_KEY exists,
 *                                 otherwise unavailable
 */
export function initializeOcrProvider(): void {
  const env = getEnv();

  if (env.OCR_PROVIDER === "none") {
    ocrService.setProvider(new UnavailableOcrProvider());
    return;
  }

  if (env.OPENAI_API_KEY) {
    ocrService.setProvider(new OpenAiVisionOcrProvider(env.OPENAI_API_KEY, env.OCR_MODEL));
    return;
  }

  ocrService.setProvider(new UnavailableOcrProvider());
}
