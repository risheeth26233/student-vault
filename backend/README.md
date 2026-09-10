# Student Vault Backend

Backend API for Student Vault - a study organizer application.

## Quick Start

### Prerequisites
- Node.js >= 20.0.0
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

3. For AI features (Phase 4+), add at least one:
   ```env
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   ```

4. For YouTube search (Phase 6):
   ```env
   YOUTUBE_API_KEY=your-youtube-data-api-v3-key
   ```

4. For web search (Phase 7):
   ```env
   BRAVE_SEARCH_API_KEY=your-brave-search-api-key
   ```

5. For image generation (Phase 8):
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
   npm run prisma:migrate
   ```
   Or for development, push schema directly:
   ```bash
   npm run prisma:push
   ```
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

## API Endpoints

### Health
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

### AI (Phase 4+)
- `POST /api/ai/chat` - Chat completion
- `POST /api/ai/chat/stream` - Streaming chat (SSE)
- `GET /api/ai/providers` - List available providers

### YouTube (Phase 6)
- `POST /api/youtube/search` - Search videos
- `GET /api/youtube/videos/:id` - Get video details
- `GET /api/youtube/status` - Check configuration

### Web Search (Phase 7)
- `POST /api/search` - Search the web
- `GET /api/search/status` - Check configuration

### Image Generation (Phase 8)
- `POST /api/images/generate` - Generate image
- `GET /api/images/status` - Check configuration

## Frontend Integration

The frontend (in `../`) communicates with the backend via these endpoints. During development:

1. Start backend: `cd backend && npm run dev` (port 3000)
2. Start frontend: `cd .. && npx vite` (port 5173)
3. Frontend calls backend at `http://localhost:3000/api/*`

CORS is configured to allow the frontend URL from `FRONTEND_URL` environment variable.

**Authentication (Phase 1 development):** All API endpoints require `x-user-id` header with a valid user ID. Phase 2 will replace this with proper authentication.

## Service Configuration

Each feature requires specific environment variables:

| Feature | Required Env Vars | Phase |
|---------|-------------------|-------|
| Topics/Notes/Exams | `DATABASE_URL` | 1 |
| Attendance | `DATABASE_URL` | 1 |
| Resources/Files | `DATABASE_URL` | 1 |
| Backup Import | `DATABASE_URL` | 1 |
| AI Chat | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | 4 |
| YouTube Search | `YOUTUBE_API_KEY` | 6 |
| Web Search | `BRAVE_SEARCH_API_KEY` | 7 |
| Image Generation | `FAL_API_KEY` or `OPENAI_API_KEY` | 8 |
| File Storage | `R2_*` credentials | 3 |
| Auth | `CLERK_*` keys | 2 |

Services without required keys return `503 Service Unavailable` with a clear message.

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

## Next Steps

See [ARCHITECTURE_AUDIT.md](../ARCHITECTURE_AUDIT.md) for the full Phase 0-10 roadmap.