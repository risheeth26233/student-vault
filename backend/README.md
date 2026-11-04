# Student Vault Backend

Backend API for Student Vault - a study organizer application.

## Quick Start

### Prerequisites
- Node.js >= 22.12.0
- npm >= 9.0.0
- PostgreSQL database (local, Neon, Supabase, etc.)

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```env
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   DATABASE_URL=postgresql://user:password@localhost:5432/student_vault
   ```

3. For AI features, add at least one:
   ```env
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   ```

4. For YouTube search:
   ```env
   YOUTUBE_API_KEY=your-youtube-data-api-v3-key
   ```

5. For web search:
   ```env
   BRAVE_SEARCH_API_KEY=your-brave-search-api-key
   ```

6. For image generation:
   ```env
   FAL_API_KEY=your-fal-ai-key
   ```

### Database Setup (Phase 1)

1. Ensure PostgreSQL is running and accessible via `DATABASE_URL`
2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Run migrations to create tables:
   ```bash
   npm run prisma:migrate:deploy
   ```
   For an existing database, verify its schema and Prisma migration history before deploying; the initial migration must not be applied blindly to a populated database. Do not substitute `prisma db push` for migration review.
4. (Optional) Open Prisma Studio to view data:
   ```bash
   npm run prisma:studio
   ```

### Development

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run typecheck
```

Run backend route tests with `npm test` and lint with `npm run lint`.

### Isolated teacher/intervention database test

`npm run test:db` runs a PostgreSQL-backed route/persistence test only when both `RUN_DATABASE_INTEGRATION_TESTS=1` and `DATABASE_TEST_URL` are set. It refuses non-loopback hosts and any database name except `student_vault_test`, verifies both checked-in migrations are applied, creates uniquely named fixture users, and deletes only those fixture users afterward. It never truncates tables or runs migrations itself. Apply migrations manually only after confirming the URL points to a newly created, disposable local test database. Without the opt-in settings the test is reported as skipped.

On Windows where Docker/Podman are unavailable, install PostgreSQL locally, create a test-only role and empty `student_vault_test` database, then set the two environment variables in the backend process environment. First run `npm run prisma:generate` and `npm run prisma:migrate:deploy` with `DATABASE_URL` explicitly set to that verified local test target; then set `DATABASE_TEST_URL` to the same test-only target and run `npm run test:db`. Never reuse the remote Neon URL or a populated development database for this test.

## Database migrations

The migrations and teacher/intervention persistence suite were successfully exercised on an isolated PostgreSQL 17.11 database on 2026-11-02. See [current verification](../docs/PROJECT_PROGRESS.md) and [deployment and recovery](../docs/DEPLOYMENT.md). Live Clerk/OCR/AI and deployment checks remain external prerequisites.

For a new PostgreSQL database, generate Prisma Client and apply checked-in migrations with `npm run prisma:migrate:deploy`. The initial migration describes the pre-teacher Student-Vault schema; the next migration adds student roles, classrooms, enrollments, and intervention storage.

For an existing database created with `prisma db push` or another untracked setup, take a backup and verify it matches the initial schema before recording that baseline as applied with `npx prisma migrate resolve --applied 20261028120000_initial_schema`. Then run `npm run prisma:migrate:deploy`. Do not mark the baseline applied against an unverified schema.

## Teacher accounts

Clerk account signup and signin are separate frontend actions; local guest profiles do not grant server access. The backend verifies bearer tokens with the configured Clerk instance and restricts authorized parties to the exact `FRONTEND_URL` origin. Only exact Clerk IDs in `TEACHER_CLERK_IDS` receive the teacher role. API callers cannot assign roles. Account persistence failures return a sanitized 503 rather than falsely reporting an expired token. Configure the primary Clerk email address and ensure display names fit the 40-character application limit.

Set `TEACHER_CLERK_IDS` to a comma-separated allowlist of Clerk user IDs. The backend derives the role from this list on authenticated requests; users cannot change their own role. A teacher creates a class and shares its private join code. Students explicitly join with that code. Teacher API queries require the class to belong to the current teacher and include only active enrollments. The current dashboard shows recorded topic states and assessment records; GuruGraph mastery is not persisted server-side.

## API Endpoints

### Health
- `GET /api/ready` - Database connectivity readiness (200/503, two-second response timeout, no credentials returned). Use alongside process liveness; migration/provider validation remains separate.
- `GET /api/health` - Health check

### Topics (Phase 1)
- `GET /api/topics` - List all topics (with query: subject, status, search, limit, offset)
- `GET /api/topics/:id` - Get a single topic
- `POST /api/topics` - Create a new topic
- `PUT /api/topics/:id` - Update a topic
- `PATCH /api/topics/:id/checklist` - Update topic checklist
- `DELETE /api/topics/:id` - Delete a topic and its resources

### Attendance (Phase 1)
- `GET /api/attendance` - List all attendance subjects with records
- `GET /api/attendance/stats` - Get overall attendance statistics
- `POST /api/attendance` - Create a new attendance subject
- `GET /api/attendance/:id` - Get an attendance subject
- `PUT /api/attendance/:id` - Update an attendance subject
- `POST /api/attendance/:id/records` - Mark a class as present/absent
- `DELETE /api/attendance/:id/records/undo` - Undo last attendance record
- `PUT /api/attendance/:id/target` - Update attendance goal target
- `DELETE /api/attendance/:id` - Delete an attendance subject and all records

### Resources (Phase 1)
- `GET /api/resources` - List all resources (query: topicId, limit, offset)
- `GET /api/resources/:id` - Get a single resource
- `POST /api/resources` - Create a new resource (base64 data URL)
- `DELETE /api/resources/:id` - Delete a resource
- `DELETE /api/resources/topic/:topicId` - Delete all resources for a topic

### Import (Phase 1)
- `POST /api/import/v1` - Import Student Vault backup v1 JSON

### AI
- `POST /api/ai/chat` - Chat completion
- `POST /api/ai/chat/stream` - Streaming chat (SSE)
- `GET /api/ai/providers` - List available providers

### YouTube
- `POST /api/youtube/search` - Search videos
- `GET /api/youtube/videos/:id` - Get video details
- `GET /api/youtube/status` - Check configuration

### Web Search
- `POST /api/search` - Search the web
- `GET /api/search/status` - Check configuration

### Image Generation
- `POST /api/images/generate` - Generate image
- `GET /api/images/status` - Check configuration

## Frontend Integration

The frontend (in `../`) communicates with the backend via these endpoints. During development:

1. Start backend: `cd backend && npm run dev` (port 3000)
2. Start frontend: `cd ../frontend && npm run dev` (port 5173)
3. Frontend calls backend at `http://localhost:3000/api/*`

CORS is configured to allow the frontend URL from `FRONTEND_URL` environment variable.

**Authentication:** API endpoints require a valid Clerk session token in `Authorization: Bearer <token>`, except the public health and Clerk webhook routes. Teacher APIs also enforce the role and class ownership server-side.

### Handwriting extraction
- `GET /api/handwriting/status` - Check whether OCR is configured.
- `POST /api/handwriting/extract` - Extract submitted pages; requires `consent: true`, validates image data, and returns explicit unavailable/provider failure states.

### Teacher classes and interventions
- `GET /api/teacher/classes`, `POST /api/teacher/classes` - Manage classes owned by the authenticated teacher.
- `GET /api/teacher/classes/:id/students` - View records for active students in a teacher-owned class.
- `POST /api/teacher/enrollments/accept` - Student explicitly joins with a teacher-shared code.
- `POST /api/teacher/classes/:id/interventions` - Propose a follow-up for an active enrolled student.
- `PATCH /api/teacher/interventions/:id` - Approve or cancel a plan owned by the teacher.
- `GET /api/student/interventions`, `PATCH /api/student/interventions/:id` - Students view approved plans and move them through in-progress to completed with an outcome note.

## Service Configuration

Each feature requires specific environment variables:

| Feature | Required Env Vars | Phase |
|---------|-------------------|-------|
| Topics/Notes/Exams | `DATABASE_URL` | 1 |
| Attendance | `DATABASE_URL` | 1 |
| Resources/Files | `DATABASE_URL` | 1 |
| Backup Import | `DATABASE_URL` | 1 |
| AI Chat and document-grounded study | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; document sharing requires an explicit request flag | 6 |
| Local PDF text extraction | Python 3 with `pypdf` from `requirements-documents.txt`; optional `PDF_PYTHON_BIN` | 6 |
| Image OCR | `OCR_PROVIDER=openai`, `OPENAI_API_KEY`; requires explicit user consent | 3/6 |
| YouTube Search | `YOUTUBE_API_KEY` | 1 |
| Web Search | `BRAVE_SEARCH_API_KEY` | 1 |
| Image Generation | `FAL_API_KEY` or `OPENAI_API_KEY` | 1 |
| File Storage | `R2_*` credentials | 1 |
| Auth | `CLERK_*` keys | 1 |

Services without required keys return `503 Service Unavailable` with a clear message.

### Document-grounded study

- Install the optional PDF parser with `python -m pip install -r requirements-documents.txt`. The API uses a bounded Python subprocess on the Student-Vault server; it does not send PDF bytes to an AI provider during extraction. Configure `PDF_PYTHON_BIN` if `python` is not on `PATH`.
- `POST /api/ai/study` accepts only current-user resource IDs and a question. It validates resource ownership, type, size, and file signature; text PDFs are parsed locally and relevant page excerpts are selected before any provider call.
- `shareWithProvider` defaults to `false`. With `false`, extracted excerpts are returned only to the authenticated user and no chat/OCR provider is called. With `true`, retrieved excerpts may be sent to the configured chat provider. Selected JPEG/PNG/WebP images may first be sent to the configured OCR provider; GIFs and other types are not OCR processed.
- Unsupported, encrypted, malformed, image-only, missing-parser, timeout, and provider-error states are returned without presenting the source as evidence. Provider answers are instructed to distinguish cited document support from general guidance.

## Security

- All secrets loaded from `.env` (never committed)
- Logger redacts sensitive headers/fields
- Helmet.js for security headers
- CORS restricted to `FRONTEND_URL`
- Input validation via Zod schemas
- Error responses never expose secrets

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Optional seed script
├── src/
│   ├── config/
│   │   └── env.ts          # Environment validation
│   ├── routes/
│   │   ├── health.ts       # Health check
│   │   ├── ai.ts           # AI endpoints
│   │   ├── youtube.ts      # YouTube endpoints
│   │   ├── search.ts       # Search endpoints
│   │   ├── images.ts       # Image endpoints
│   │   ├── topics.ts       # Topics CRUD
│   │   ├── attendance.ts   # Attendance CRUD
│   │   ├── resources.ts    # Resources CRUD
│   │   └── import.ts       # Backup import
│   ├── utils/
│   │   └── prisma.ts       # Prisma client singleton
│   └── index.ts            # App entry point
├── .env.example            # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Project roadmap and current state

The project roadmap is locked to seven phases. See [the phase-by-phase progress record](../docs/PROJECT_PROGRESS.md) for implementation status, verification results, provider limitations, and migration setup. Teacher and intervention migrations are additive; use `npm run prisma:migrate:deploy` only after configuring and verifying the intended database.
