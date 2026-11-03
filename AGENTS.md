# Student-Vault × GuruGraph — AGENTS.md

## Locked Roadmap (7 Phases)

The project has exactly seven major phases. This roadmap is locked — do not add phases or subphases, and do not begin a phase until it is explicitly authorized.

| # | Phase | Status |
|---|-------|--------|
| 1 | Student-Vault Foundation | ✅ COMPLETE |
| 2 | GuruGraph Learning Intelligence | ✅ IMPLEMENTED (deterministic read-only foundation + Learning Insights UI) |
| 3 | Adaptive & Handwritten Intelligence | ✅ COMPLETE |
| 4 | Teacher Intelligence | 🚧 IN PROGRESS |
| 5 | Intervention & Student–Teacher Loop | 🚧 IN PROGRESS |
| 6 | AI Study & Academic Ecosystem | 🚧 IN PROGRESS |
| 7 | Production & Intelligence Maturity | 🚧 HARDENING IN PROGRESS; DATABASE/DEPLOYMENT VERIFICATION REMAINS |

**Phase gate rule:** Phase 3+ functionality must not be implemented until explicitly authorized. Phase 2 is complete to the extent verified by the test/build/lint suites below.

---

## Phase 1 Architectural Decision

### Feature Parity Matrix

| Feature | Legacy (Vanilla JS) | React (Vite) | Backend (Fastify) | Decision |
|---------|---------------------|--------------|-------------------|----------|
| **Authentication** | ✅ Clerk + local fallback, dynamic load | ✅ AuthProvider + Clerk init | ✅ Clerk JWT verification, webhook | **Migrate to React** — React has cleaner provider pattern |
| **Student Profile** | ✅ Name/email in localStorage | ✅ Profile in AuthContext | ✅ User + Profile models | **Migrate to React** |
| **Dashboard** | ✅ Overview stats, focus message, study visual | ❌ Placeholder only | ✅ Topics/attendance/stats endpoints | **Migrate to React** — Build new dashboard |
| **Subjects** | ✅ Inline in topic list (filter by subject) | ❌ Placeholder | ✅ Subject field on Topic model | **Migrate to React** — Add dedicated subject management |
| **Topics** | ✅ Full CRUD, checklist, exam date, status, notes, filtering, search | ❌ Placeholder | ✅ Full CRUD + checklist PATCH | **Migrate to React** — Core feature |
| **Notes** | ✅ Inline textarea per topic, debounced save | ❌ Placeholder | ✅ Notes field on Topic | **Migrate to React** |
| **PDFs/Documents** | ✅ Attach via file input → base64 → IndexedDB, R2 upload if configured | ❌ Placeholder | ✅ Resources CRUD, R2 presigned URLs, 20MB limit | **Migrate to React** — Use R2 direct upload |
| **Images** | ✅ Same as PDFs, preview in resource list | ❌ Placeholder | ✅ Same Resources model | **Migrate to React** |
| **YouTube/Videos** | ✅ Search form, results with thumbnails, metadata | ❌ Placeholder | ✅ YouTube Data API v3 search + details | **Migrate to React** |
| **Search (Web)** | ✅ Brave Search form, results cards | ❌ Placeholder | ✅ Brave Search API | **Migrate to React** |
| **Attendance** | ✅ Subjects, present/absent, undo, target %, overall + per-subject stats | ❌ Placeholder | ✅ Full CRUD + stats + undo | **Migrate to React** — Core feature |
| **AI Chat** | ✅ Chat UI, streaming, provider select, usage tokens | ❌ Placeholder | ✅ OpenAI/Anthropic, streaming SSE | **Migrate to React** |
| **Image Generation** | ✅ Form with params, gallery of results | ❌ Placeholder | ✅ Fal.ai / DALL-E | **Migrate to React** |
| **Sync/PWA** | ✅ Pull/push with conflict resolution, R2 upload/download URLs, SW cache | ⚠️ VitePWA configured only | ✅ Full sync protocol + R2 | **Migrate to React** — Use VitePWA + sync hooks |
| **Calculator** | ❌ NOT IMPLEMENTED (only attendance %) | ❌ Placeholder | ❌ No model | **Build new in React** — Grade/academic calculator |
| **Assignments** | ❌ NOT IMPLEMENTED | ❌ Placeholder | ❌ No model | **Build new in React + Backend** |
| **Academic Performance** | ❌ NOT IMPLEMENTED (only attendance %) | ❌ Placeholder | ❌ No model | **Build new in React + Backend** |
| **Search Foundation** | ✅ Web search + YouTube search | ❌ Placeholder | ✅ Both APIs | **Migrate to React** |
| **Notification Foundation** | ✅ Toast system | ✅ ToastProvider | ❌ No backend notifications | **Migrate to React** — Add backend later |
| **Responsive UI** | ✅ Mobile-first CSS, touch-friendly | ✅ Tailwind 4 + Radix UI (responsive) | N/A | **React wins** — Better component system |
| **Offline/IndexedDB** | ✅ Full offline support, auto-sync | ⚠️ Not implemented | N/A | **Migrate to React** — Add Workbox background sync |

### Architectural Decision: **Option A — Continue React and Migrate Legacy Functionality**

**Justification:**

1. **Maintainability**: React + TypeScript + TanStack Query provides better long-term maintainability than 1900-line vanilla JS
2. **Component Reusability**: Radix UI + Tailwind 4 design system scales for GuruGraph Phase 2+
3. **Type Safety**: End-to-end TypeScript (shared types via `frontend/src/types/api.ts` matching backend Zod schemas)
4. **Testing**: React Testing Library + Vitest + Playwright is standard; vanilla JS has no test setup
5. **Developer Experience**: Hot module replacement, TypeScript errors in IDE, component isolation
6. **Future GuruGraph Integration**: React's component architecture maps cleanly to GuruGraph's node-based UI (knowledge graph viz, adaptive practice components, teacher dashboard widgets)
7. **Backend Compatibility**: Backend already built for React (CORS, API contracts, sync protocol)
8. **PWA**: VitePWA + Workbox is production-ready; legacy SW is basic cache-first
9. **Responsive**: Tailwind 4 mobile-first utilities > custom CSS media queries
10. **Duplication Cost**: Legacy has ~15 features working; React has 0. But React scaffolding (auth, layout, hooks, UI lib) is ~80% of the "plumbing" — only feature components missing

**Migration Strategy:**
- Keep legacy at `/` (current `index.html`) as fallback during migration
- Build React features at `/app/*` routes progressively
- Share backend API (already compatible)
- When React reaches feature parity, switch root to React, archive legacy to `/legacy/`
- Do NOT delete legacy until React parity verified

---

## Phase 1 Implementation Order

1. **Architecture Reconciliation** ✓ (this document)
2. **AGENTS.md** ✓ (this document)
3. **Primary Frontend**: React at `frontend/` with `/app` base path
4. **Preserve Legacy**: Keep at root, add `/legacy` redirect later
5. **Authentication** — Complete React Clerk integration
6. **Student Profile** — Profile page + avatar
7. **Dashboard** — Stats cards, upcoming exams, recent activity
8. **Subjects** — Subject list, create/edit, topic counts
9. **Topics** — Full CRUD, checklist, exam date, status, filtering
10. **Notes** — Rich text editor (TipTap or textarea + markdown)
11. **PDFs/Documents** — R2 direct upload, preview, download
12. **Images** — Preview, full-screen view
13. **Videos/YouTube** — Search, embed player, save to topic
14. **Study Mode** — Focused view: topic + notes + resources + pomodoro
15. **Calculator** — Grade calculator, GPA, exam score needed
16. **Assignments** — New backend model + React CRUD
17. **Attendance** — Migrate from legacy
18. **Academic Performance** — New backend model + charts (Recharts)
19. **Search Foundation** — Unified search (topics + web + YouTube)
20. **Notification Foundation** — Toast + in-app notification center
21. **Responsive UI** — Mobile-first, touch targets, sidebar collapse
22. **API/Database Cleanup** — Add Assignment, AcademicPerformance models
23. **Security** — CSP, rate limiting, input sanitization
24. **Tests** — Unit (Vitest), Integration (API), E2E (Playwright)
25. **Build** — Production builds for both frontend + backend
26. **UI Verification** — Manual checklist + automated visual regression

---

## Phase 2 — GuruGraph Learning Intelligence (Implemented)

**What Phase 2 added (deterministic, read-only, explainable):**
- Typed domain boundary: `frontend/src/gurugraph/domain/` (types, constants/thresholds, deterministic ids).
- Signal normalization: `frontend/src/gurugraph/signals/normalize.ts` maps existing Student-Vault records (topics, assessments, assignments, attendance, resources) into normalized learning signals. Read-only — never writes back.
- Deterministic mastery: `frontend/src/gurugraph/intelligence/mastery.ts` (weighted evidence average with an explicit `insufficient_evidence` state).
- Gap classification: `frontend/src/gurugraph/intelligence/gaps.ts` (five distinguishable states; `confirmed_misconception` is reserved and never emitted).
- Service + storage boundary: `frontend/src/gurugraph/service/` (localStorage-persisted, offline-friendly, never touches `sv_*` keys).
- Student-Vault integration: `frontend/src/gurugraph/integration/useGuruGraphIntelligence.ts` — the ONLY bridge; subscribes to existing Phase 1 queries, read-only.
- Learning Insights UI: route `/insights` (`frontend/src/pages/LearningInsightsPage.tsx` + `frontend/src/features/insights/`). Consumes the integration hook; adds no duplicate intelligence logic. Desktop sidebar + tablet drawer entry; mobile bottom nav stays five items. Loading/error/retry/offline states, honest insufficient-evidence handling, expandable "Why?" separating observed evidence from inferred/classified conclusions.

**Phase 2 boundaries (deferred to later phases — do NOT implement here):**
- Adaptive practice generation (Phase 3)
- Handwriting analysis/diagnosis (Phase 3)
- Teacher intelligence (Phase 4)
- Student–teacher intervention workflows (Phase 5)
- Advanced AI agents / knowledge-graph visualization (Phase 6+)

**Testing:** see Commands Reference — `npm run test` runs both the GuruGraph unit tests and the Learning Insights view-model/component tests.

---

## Phase 3 — Adaptive & Handwritten Intelligence (Implemented)

**What Phase 3 added (honest, deterministic, local-first):**
- **Workflow UI** — route `/handwriting` ("Practice" in sidebar + tablet drawer; mobile bottom nav stays the original five items). Submission composer: subject/topic selection, multi-page image upload (≤8 pages, ≤8MB each, JPEG/PNG/WebP), dismissible per-file rejection reasons (never silent), upload retry queue for failed files, previews from resource storage, two-step page removal. Flow states: extraction review → evaluation → practice/reassessment → progress timeline, all on the same submission record.
- **Backend OCR boundary (stateless, consent-enforced)** — `GET /api/handwriting/status`, `POST /api/handwriting/extract` (≤8 pages, mime/size validated server-side, `consent: true` required → otherwise 400 `consent_required`). `OcrProvider` interface in `backend/src/services/ocr.ts`; `UnavailableOcrProvider` is the default; `OpenAiVisionOcrProvider` only when `OPENAI_API_KEY` is set and `OCR_PROVIDER=openai`. Unconfigured → 503 `ocr_unavailable`; the frontend then offers manual transcription. No fake engines, no keys shipped.
- **Local-first records** — `sv_handwriting` localStorage envelope (version 1). Page images reuse the existing resource blob storage (IndexedDB/R2) — image bytes never enter localStorage.
- **Evaluation (deterministic, `features/handwriting/evaluation.ts`)** — six distinguishable states: `confirmed_error`, `plausible_gap`, `insufficient_evidence`, `extraction_failure`, `evaluation_unavailable`, `no_gap`. Matching final answers are explicitly *not* proof of reasoning; the reserved `confirmed_misconception` state is never emitted. Observed facts and inferred conclusions render as separate labelled groups with confidence + caveat on every outcome. Re-confirmed text after an evaluation marks it stale until re-run.
- **Adaptive practice (`practiceEngine.ts`)** — deterministic question templates generated from topic title/notes + evaluation gaps + GuruGraph gaps (read-only); provenance labelled "generated · not syllabus-verified"; automatic coverage check with visible limitations; duplicate-answer rejection; stretch question locked until a first passing attempt; reassessment path; attempts recorded per submission.
- **Progress (`progressModel.ts`)** — only definite observations (definite evaluations + graded attempts) support direction claims; uncertain/stale/ungraded evidence is excluded and the exclusions are stated; without a definite baseline the summary honestly reports `not_enough_evidence`.
- **GuruGraph integration** — `LearningSignalKind: 'practice_outcome'` (weight 0.7), `SignalSourceType: 'handwriting'`; ungraded attempts contribute nothing to mastery; Learning Insights gains a "Handwritten practice" evidence section linking back to the workflow. Phase 2 classification meanings are unchanged; `IngestReport.accepted` shape unchanged.
- **Testing** — `npm run test` = 212 tests: all Phase 1/2 suites unmodified plus handwriting validation, evaluation states, practice engine, extraction service (incl. retry-never-resends-confirmed-pages), local store (duplicate prevention, persistence across reload), evidence/progress models, GuruGraph practice-outcome wiring, and jsdom component tests (composer, extraction review, evaluation/practice/progress panels, page orchestration, navigation five-item rule, insights evidence section).

**Phase 3 boundaries (deferred to later phases — NOT implemented):**
- Teacher intelligence (Phase 4)
- Intervention & student–teacher loop (Phase 5)
- AI study ecosystem features beyond the above (Phase 6)
- Emitted `confirmed_misconception` states (reserved until justified)
- No backend persistence models were added — records are local-first by design.

**Verification:** frontend tests passed 212 cases; backend OCR route tests cover the auth boundary, consent, validation, provider fallback/success/failure. Frontend and backend builds, typechecks and lint commands were run. Real OpenAI OCR behavior still requires credentials to verify.

---

## GuruGraph Deferred Boundary (Phase 4+)

**Architecture Preparation (done in Phase 1):**
- `frontend/src/features/` structure for feature modules
- `frontend/src/graph/` placeholder for knowledge graph components
- `backend/src/services/graph/` placeholder for graph engine
- Shared types in `frontend/src/types/gurugraph.ts` (empty for now)
- Event bus for Coach orchestration (extend existing sync events)

**Still deferred beyond the current Phase 3–7 checkpoint:**
- Full knowledge-graph intelligence / visualization
- Misconception engine (a deterministic *candidate* gap state is reserved but never emitted)
- Diagnostician / Examiner / Curator / Analyst agents
- Coach orchestration
- Teacher intelligence
- Interventions
- AI Study Assistant (beyond current chat)

Note: the deterministic **mastery engine** and **gap classification** shipped in Phase 2 (see the Phase 2 section above); the adaptive **practice engine**, **handwritten-work workflow** and **OCR boundary** shipped in Phase 3 (see the Phase 3 section above) — all read-only/deterministic foundations, not the deferred intelligence.

## Phases 4–7 — Current implementation checkpoint

- Phase 4 adds Clerk-ID allowlisted teacher roles, owned classrooms, explicit student join-code enrollment, role- and ownership-scoped teacher APIs, individual student evidence, and class-level counts of recorded topic statuses. Counts are observations; mastery and learning-gap summaries are not persisted server-side.
- Phase 5 adds teacher-proposed and reviewed plans, student lifecycle updates, transition events, latest topic-assessment baselines, paired student-entered reassessment scores, cautious percentage-point comparisons, and teacher feedback. A score comparison does not establish causal impact.
- Phase 6 has typed provider-backed chat and a local-only deterministic study scaffold when no provider is configured. Saved notes remain local by default. Selected resources support local PDF extraction and page retrieval; explicitly opted-in retrieved excerpts can be sent to a configured provider. Invalid or unrecognized citations fall back to actual excerpts.
- Phase 7 adds Svix webhook signature verification, bounded request rates, provider timeouts, AI input limits, sanitized request error logging, and CORS support for PATCH. Rate limits are in-memory per process. Real migrations and persistence tests passed on an isolated PostgreSQL database on 2026-11-02. Deployment verification remains required before claiming production readiness.
- Both migrations were applied to a disposable local student_vault_test database; live schema comparison found no difference and persistence/rollback tests passed. The configured remote database was not contacted. See docs/PROJECT_PROGRESS.md for current verification and docs/DEPLOYMENT.md for release prerequisites.

---

## Commands Reference

```bash
# Backend
cd backend
npm run dev          # Dev server with hot reload
npm run build        # TypeScript compile
npm run start        # Production server
npm run typecheck    # Type check only
npm run lint         # ESLint
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio

# Frontend (React)
cd frontend
npm run dev          # Vite dev server (proxies /api to backend:3000)
npm run build        # Production build
npm run lint         # Oxlint
npm run test         # Vitest (GuruGraph unit + Learning Insights + handwriting workflow tests)
npm run preview      # Preview production build

# Legacy (root)
npx serve .          # Serve legacy app
```

---

## Environment Variables Required

**Backend (.env):**
```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
# Optional services:
OPENAI_API_KEY=...
# Handwriting OCR (Phase 3) — provider-independent; without these the app
# offers manual transcription and reports extraction as unavailable:
OCR_PROVIDER=none     # 'openai' | 'none' — requires OPENAI_API_KEY
OCR_MODEL=gpt-4o-mini # optional override for the vision model
ANTHROPIC_API_KEY=...
YOUTUBE_API_KEY=...
BRAVE_SEARCH_API_KEY=...
FAL_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
```

**Frontend (index.html meta tag):**
```html
<meta name="clerk-publishable-key" content="pk_..." />
```

---

## Git Safety Rules

- Never delete legacy frontend (`index.html`, `script.js`, `api.js`, `styles.css`, `sw.js`)
- Never delete React frontend (`frontend/`)
- Never reset repository
- Commit before destructive changes
- Use feature branches for major migrations
