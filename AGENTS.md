# Student-Vault × GuruGraph — AGENTS.md

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

## GuruGraph Future Boundary (Phase 2+)

**Architecture Preparation (do in Phase 1):**
- `frontend/src/features/` structure for feature modules
- `frontend/src/graph/` placeholder for knowledge graph components
- `backend/src/services/graph/` placeholder for graph engine
- Shared types in `frontend/src/types/gurugraph.ts` (empty for now)
- Event bus for Coach orchestration (extend existing sync events)

**DO NOT IMPLEMENT IN PHASE 1:**
- Knowledge Graph intelligence
- Mastery engine
- Misconception engine
- Diagnostician / Examiner / Curator / Analyst agents
- Coach orchestration
- Adaptive practice
- Handwriting diagnosis
- Teacher intelligence
- Interventions
- AI Study Assistant (beyond current chat)

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