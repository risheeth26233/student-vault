# Student Vault

A browser-based study organizer for exam preparation.

## Use it

1. Open `index.html` in a browser.
2. Add a subject, topic, and optional exam date.
3. Write revision notes and tick the checklist as you prepare.
4. Use **Attach PDF or photo** to keep study resources with the right topic.
5. Choose **Browse sources** to search the web for that topic.

Topics and notes are stored in this browser. PDF and photo attachments are stored in the browser database on this computer. Do not clear browser site data if you want to keep the saved materials.

---

## Backend API (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7)

The backend provides a REST API for persisting Student Vault data to PostgreSQL with Clerk authentication, Cloudflare R2 file storage, AI providers, YouTube Data API v3, Brave Search API, and Image Generation (Fal.ai/DALL-E).

### Quick Start

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, Clerk keys, and R2 credentials
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Server runs at `http://localhost:3000`

### Environment Variables

See `backend/.env.example` for all options. Required:

- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - CORS origin (default: http://localhost:5173)
- `CLERK_SECRET_KEY` - Clerk secret key for authentication
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key for frontend
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret for user sync

For Phase 3 (Cloud Sync + R2):

- `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - R2 access key ID
- `R2_SECRET_ACCESS_KEY` - R2 secret access key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - R2 public URL (optional, for direct access)

For Phase 4 (AI Services):

- `OPENAI_API_KEY` - OpenAI API key (for GPT models and embeddings)
- `ANTHROPIC_API_KEY` - Anthropic API key (for Claude models)

For Phase 5 (YouTube Data API v3):

- `YOUTUBE_API_KEY` - YouTube Data API v3 key (from Google Cloud Console)

For Phase 6 (Brave Search API):

- `BRAVE_SEARCH_API_KEY` - Brave Search API key (from https://brave.com/search/api/)

For Phase 7 (Image Generation):

- `FAL_API_KEY` - Fal.ai API key (recommended, from https://fal.ai) - supports Flux, SDXL, and other models
- `OPENAI_API_KEY` - OpenAI API key (fallback for DALL-E 2/3)

### Authentication

All API endpoints (except `/api/health` and `/api/webhooks/clerk`) require a valid Clerk session token in the `Authorization` header:

```
Authorization: Bearer <session_token>
```

The session token is obtained from Clerk on the frontend after user sign-in.

### API Endpoints

#### Health (Public)
- `GET /api/health` - Health check

#### Clerk Webhook (Public)
- `POST /api/webhooks/clerk` - Handle Clerk user events (user.created, user.updated, user.deleted)

#### Sync (Authenticated)
- `GET /api/sync/status` - Get sync status (last sync time, server version)
- `POST /api/sync/pull` - Pull all user data from server (server -> client)
- `POST /api/sync/push` - Push local changes to server with conflict resolution (client -> server)
- `GET /api/sync/r2/upload-url` - Get presigned URL for uploading a file to R2
- `GET /api/sync/r2/download-url` - Get presigned URL for downloading a file from R2

#### AI (Authenticated) (Phase 4)
- `POST /api/ai/chat` - Chat with AI assistant
- `POST /api/ai/chat/stream` - Stream chat with AI assistant
- `GET /api/ai/providers` - List available AI providers

#### YouTube (Authenticated) (Phase 5)
- `POST /api/youtube/search` - Search YouTube videos
- `GET /api/youtube/videos/:id` - Get video details by ID
- `GET /api/youtube/status` - Check YouTube service configuration

#### Search (Authenticated) (Phase 6)
- `POST /api/search` - Search the web for educational resources
- `GET /api/search/status` - Check search service configuration

#### Images (Authenticated) (Phase 7)
- `POST /api/images/generate` - Generate an educational image/diagram
- `GET /api/images/status` - Check image generation service configuration

#### Topics (Authenticated)
- `GET /api/topics` - List topics (query: subject, status, search, limit, offset)
- `GET /api/topics/:id` - Get topic by ID
- `POST /api/topics` - Create topic
- `PUT /api/topics/:id` - Update topic
- `PATCH /api/topics/:id/checklist` - Update checklist
- `DELETE /api/topics/:id` - Delete topic

#### Attendance (Authenticated)
- `GET /api/attendance` - List attendance subjects with records
- `GET /api/attendance/stats` - Overall attendance statistics
- `GET /api/attendance/:id` - Get attendance subject
- `POST /api/attendance` - Create attendance subject
- `PUT /api/attendance/:id` - Update attendance subject
- `POST /api/attendance/:id/records` - Add record (present/absent)
- `DELETE /api/attendance/:id/records/undo` - Undo last record
- `PUT /api/attendance/:id/target` - Update target percentage
- `DELETE /api/attendance/:id` - Delete attendance subject

#### Resources (Authenticated)
- `GET /api/resources` - List resources (query: topicId, limit, offset)
- `GET /api/resources/:id` - Get resource
- `POST /api/resources` - Create resource (base64 data URL or R2 key)
- `DELETE /api/resources/:id` - Delete resource
- `DELETE /api/resources/topic/:topicId` - Delete all resources for topic

#### Import (v1) (Authenticated)
- `POST /api/import/v1` - Import Student Vault backup v1

**Request body:**
```json
{
  "version": 1,
  "exportedAt": "2026-01-15T10:30:00.000Z",
  "profile": { "name": "John Doe" },
  "topics": [{ "id": "1", "subject": "Math", "title": "Calculus", "examDate": "2026-06-01T00:00:00.000Z", "notes": "Review limits", "status": "learning", "checklist": { "understand": true, "practice": false, "revise": false }, "createdAt": "2026-01-01T00:00:00.000Z" }],
  "attendanceSubjects": [{ "id": "1", "name": "Math", "target": 75, "records": ["present", "absent", "present"] }],
  "resources": [{ "id": "1", "topicId": "1", "name": "notes.pdf", "type": "application/pdf", "size": 1024, "data": "data:application/pdf;base64,...", "addedAt": "2026-01-01T00:00:00.000Z" }]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backup imported successfully from 1/15/2026, 10:30:00 AM",
  "stats": { "topicsImported": 1, "attendanceSubjectsImported": 1, "resourcesImported": 1 }
}
```

### Sync Protocol (Phase 3)

The sync protocol uses a version-based conflict resolution strategy:

1. **Pull**: Client calls `POST /api/sync/pull` to get all server data + a `serverVersion` timestamp
2. **Local changes**: Client makes changes locally (localStorage/IndexedDB)
3. **Push**: Client calls `POST /api/sync/push` with changes + `clientVersion` (last known serverVersion)
4. **Conflict detection**: Server compares `updatedAt` timestamps against `clientVersion`
5. **Resolution**: Conflicts are returned to client for manual resolution; non-conflicting changes are applied

**Push Request Body:**
```json
{
  "profile": { "name": "John Doe" },
  "topics": [{ "id": "1", "subject": "Math", "title": "Calculus", ..., "_deleted": false }],
  "attendanceSubjects": [{ "id": "1", "name": "Math", "target": 75, "records": [...], "_deleted": false }],
  "resources": [{ "id": "1", "topicId": "1", "name": "notes.pdf", "mimeType": "application/pdf", "size": 1024, "r2Key": "users/.../1.pdf", "_deleted": false }],
  "clientVersion": 1700000000000
}
```

**Conflict Response:**
```json
{
  "success": false,
  "message": "Conflicts detected. Please resolve.",
  "serverVersion": 1700000100000,
  "conflicts": [
    { "type": "topic", "id": "1", "serverData": {...}, "clientData": {...} }
  ],
  "stats": { "topicsCreated": 0, "topicsUpdated": 0, ... }
}
```

### R2 File Storage (Phase 3)

When R2 is configured, resources are stored in Cloudflare R2 instead of base64 in the database:

1. Client requests upload URL: `GET /api/sync/r2/upload-url?resourceId=...&fileName=...&contentType=...`
2. Client uploads file directly to R2 using the presigned URL
3. Client creates resource record via `POST /api/resources` with `r2Key` (no base64 data)
4. Download: `GET /api/sync/r2/download-url?key=...` returns presigned download URL

### Development

```bash
npm run dev          # Start with hot reload
npm run build        # TypeScript compilation
npm run typecheck    # Type checking only
npm run lint         # ESLint
npm run prisma:studio # Open Prisma Studio
```