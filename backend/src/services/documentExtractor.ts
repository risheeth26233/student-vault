import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type PdfExtractFailure = "invalid_pdf" | "encrypted_pdf" | "empty_pdf" | "too_many_pages" | "no_extractable_text" | "malformed_pdf" | "file_too_large" | "extractor_unavailable" | "extractor_timeout" | "extractor_failed";
export type PdfExtractResult = { ok: true; pages: Array<{ page: number; text: string }>; truncated: boolean } | { ok: false; error: PdfExtractFailure };

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_RESULT_BYTES = 512 * 1024;
const EXTRACTOR_TIMEOUT_MS = 15_000;
const scriptPath = fileURLToPath(new URL("../../scripts/extract_pdf.py", import.meta.url));
const knownErrors = new Set<PdfExtractFailure>(["invalid_pdf", "encrypted_pdf", "empty_pdf", "too_many_pages", "no_extractable_text", "malformed_pdf", "file_too_large", "extractor_unavailable"]);

/** Runs parsing out of process so malformed PDFs cannot crash the API process. */
export function extractPdfText(bytes: Uint8Array): Promise<PdfExtractResult> {
  if (bytes.byteLength > MAX_PDF_BYTES) return Promise.resolve({ ok: false, error: "file_too_large" });
  if (bytes.byteLength < 8 || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    return Promise.resolve({ ok: false, error: "invalid_pdf" });
  }

  return new Promise((resolve) => {
    const python = process.env.PDF_PYTHON_BIN || "python";
    let child;
    try {
      child = spawn(python, [scriptPath], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    } catch {
      resolve({ ok: false, error: "extractor_unavailable" });
      return;
    }

    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (result: PdfExtractResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: "extractor_timeout" });
    }, EXTRACTOR_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_RESULT_BYTES) {
        child.kill();
        finish({ ok: false, error: "extractor_failed" });
        return;
      }
      output.push(chunk);
    });
    child.on("error", () => finish({ ok: false, error: "extractor_unavailable" }));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish({ ok: false, error: "extractor_failed" });
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(output).toString("utf8")) as {
          pages?: Array<{ page: number; text: string }>;
          truncated?: boolean;
          error?: string;
        };
        if (parsed.error && knownErrors.has(parsed.error as PdfExtractFailure)) {
          finish({ ok: false, error: parsed.error as PdfExtractFailure });
        } else if (Array.isArray(parsed.pages) && parsed.pages.length > 0 && parsed.pages.every((page) => Number.isInteger(page.page) && typeof page.text === "string")) {
          finish({ ok: true, pages: parsed.pages, truncated: parsed.truncated === true });
        } else {
          finish({ ok: false, error: "extractor_failed" });
        }
      } catch {
        finish({ ok: false, error: "extractor_failed" });
      }
    });
    child.stdin.on("error", () => finish({ ok: false, error: "extractor_failed" }));
    child.stdin.end(Buffer.from(bytes));
  });
}
