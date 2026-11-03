import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromDocuments, retrieveRelevantExcerpts, type ExtractedStudyDocument } from "./documentStudy.js";

const documents: ExtractedStudyDocument[] = [
  { resourceId: "res-bio", title: "Biology Notes.pdf", pages: [{ page: 1, text: "Photosynthesis converts light energy into chemical energy in plants. Chlorophyll absorbs light." }] },
  { resourceId: "res-math", title: "Algebra.pdf", pages: [{ page: 1, text: "A quadratic equation has the form ax squared plus bx plus c equals zero." }] },
];

test("retrieval returns only passages matching the study question", () => {
  const excerpts = retrieveRelevantExcerpts("How does chlorophyll work in photosynthesis?", documents);
  assert.equal(excerpts.length, 1);
  assert.equal(excerpts[0].resourceId, "res-bio");
  assert.equal(excerpts[0].page, 1);
});

test("provider receives retrieved passages with citation and untrusted-document instructions", async () => {
  let providerMessages: unknown;
  const result = await answerFromDocuments({
    question: "What does chlorophyll do?",
    documents,
    shareWithProvider: true,
    provider: { name: "test-provider", chat: async (options) => { providerMessages = options.messages; return { content: "Chlorophyll absorbs light. [Resource: Biology Notes.pdf, page 1]" }; } },
  });
  assert.equal(result.mode, "provider_grounded");
  assert.equal(result.sources[0].resourceId, "res-bio");
  assert.match(JSON.stringify(providerMessages), /Chlorophyll absorbs light/);
  assert.match(JSON.stringify(providerMessages), /untrusted data/);
  assert.match(result.answer, /Resource: Biology Notes.pdf, page 1/);
});

test("local mode does not call provider and reports excerpts without generated facts", async () => {
  let called = false;
  const result = await answerFromDocuments({ question: "What does chlorophyll do?", documents, shareWithProvider: false, provider: { name: "test", chat: async () => { called = true; return { content: "wrong" }; } } });
  assert.equal(called, false);
  assert.equal(result.mode, "local_excerpts");
  assert.match(result.answer, /No AI chat provider received these excerpts/i);
  assert.match(result.answer, /Chlorophyll absorbs light/);
});

test("missing provider and unreadable documents return honest fallbacks", async () => {
  const missingProvider = await answerFromDocuments({ question: "What does chlorophyll do?", documents, shareWithProvider: true });
  assert.equal(missingProvider.providerAttempted, false);
  assert.match(missingProvider.notice, /No AI provider is configured/);
  const unavailable = await answerFromDocuments({ question: "What is in this file?", documents: [{ resourceId: "broken", title: "scan.pdf", pages: [], error: "no_extractable_text" }], shareWithProvider: true });
  assert.equal(unavailable.mode, "no_sources");
  assert.equal(unavailable.sources.length, 0);
  assert.equal(unavailable.sourceErrors[0].error, "no_extractable_text");
});

test("provider failures preserve retrieved text and do not claim it supported an answer", async () => {
  const result = await answerFromDocuments({ question: "What does chlorophyll do?", documents, shareWithProvider: true, provider: { name: "broken-provider", chat: async () => { throw new Error("provider timeout"); } } });
  assert.equal(result.mode, "local_excerpts");
  assert.equal(result.providerAttempted, true);
  assert.equal(result.sources[0].resourceId, "res-bio");
  assert.match(result.notice, /may have reached/);
});

test("fabricated page references and malformed provider responses fall back to actual excerpts", async () => {
  for (const content of ["Invented answer [Resource: Biology Notes.pdf, page 99]", "An answer with no evidence citation", "x".repeat(20_001), undefined]) {
    const result = await answerFromDocuments({
      question: "What does chlorophyll do?", documents, shareWithProvider: true,
      provider: { name: "test", chat: async () => ({ content: content as string }) },
    });
    assert.equal(result.mode, "local_excerpts");
    assert.equal(result.sources[0].page, 1);
    assert.doesNotMatch(result.answer, /page 99/);
  }
});
