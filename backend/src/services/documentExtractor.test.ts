import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { extractPdfText } from "./documentExtractor.js";

function makePdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 36 80 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

const python = process.env.PDF_PYTHON_BIN || "python";
const hasPypdf = spawnSync(python, ["-c", "import pypdf"], { timeout: 5_000, windowsHide: true }).status === 0;

test("extracts selectable text and page identity from a real PDF", { skip: !hasPypdf && "Python with pypdf is not installed" }, async () => {
  const result = await extractPdfText(makePdf("Photosynthesis uses chlorophyll"));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pages[0].page, 1);
    assert.match(result.pages[0].text, /Photosynthesis uses chlorophyll/);
  }
});

test("rejects unsupported signatures, malformed PDFs, and empty-text PDFs clearly", { skip: !hasPypdf && "Python with pypdf is not installed" }, async () => {
  assert.deepEqual(await extractPdfText(Buffer.from("not a PDF")), { ok: false, error: "invalid_pdf" });
  const malformed = await extractPdfText(Buffer.from("%PDF-1.7\nmalformed body"));
  assert.deepEqual(malformed, { ok: false, error: "malformed_pdf" });
  const empty = await extractPdfText(makePdf(""));
  assert.deepEqual(empty, { ok: false, error: "no_extractable_text" });
});
