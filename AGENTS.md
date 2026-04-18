# @pinpoint — Agent Reference

Agent-facing integration guide for the Pinpoint SDK backend. Use this file to understand how to deploy, configure, and extend the system.

## Architecture

```
@pinpoint/shared          @pinpoint/react           @pinpoint/worker           @pinpoint/dashboard
┌─────────────────┐      ┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ types.ts         │◄─────│ PinpointProvider     │    │ Hono CF Worker      │    │ React SPA (Vite)   │
│ validators.ts    │      │ HighlightOverlay   │───▶│ ├─ auth/jwt.ts      │◄───│ ├─ views/           │
│ constants        │      │ CommentPopover     │    │ ├─ middleware/cors.ts│    │ ├─ components/      │
└─────────────────┘      │ ScreenshotCapture  │    │ ├─ routes/feedback  │    │ └─ api/ hooks       │
                          │ DOMSerializer       │    │ ├─ routes/projects │    └─────────────────────┘
                          │ FeedbackSubmitter   │    │ ├─ db/ repos        │
                          └───────────────────┘    │ └─ storage/r2        │
                                                    └────────────────────┘
```

**Data flow:** User highlights element → SDK captures screenshot + DOM snapshot → POSTs multipart/form-data to worker → worker validates via `@pinpoint/shared`, stores screenshot/DOM in R2, inserts metadata in D1 → dashboard queries worker API.

## Deployment

### Prerequisites

- Cloudflare account with D1 and R2 access
- Node.js 20+, pnpm 10+

### 1. Create D1 database

```bash
cd packages/worker
wrangler d1 create feedback-db
# Copy the database_id from output into wrangler.toml
```

### 2. Create R2 bucket

```bash
wrangler r2 bucket create feedback-assets
```

### 3. Apply migrations locally

```bash
wrangler d1 migrations apply feedback-db --local --config wrangler.toml
```

### 4. Run locally

```bash
# Terminal 1: Worker (port 8787)
cd packages/worker
wrangler dev --config wrangler.toml --port 8787

# Terminal 2: Dashboard (port 5173, proxies /api → 8787)
cd packages/dashboard
pnpm dev
```

### 5. Deploy to Cloudflare

```bash
# Build dashboard first (worker serves it as static assets)
cd packages/dashboard && pnpm build

# Deploy worker (includes dashboard assets)
cd packages/worker
wrangler deploy
```

For production, uncomment the `[assets]` block in `wrangler.toml`:

```toml
[assets]
directory = "../dashboard/dist"
run_worker_first = ["/api/*"]
not_found_handling = "single-page-application"
```

## Configuration

### Environment Variables (wrangler.toml `[vars]`)

| Variable | Required | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | Yes | Comma-separated origins for CORS, or `*` for any |
| `CF_ACCESS_TEAM_DOMAIN` | No | Cloudflare Access team domain for JWT auth. Empty = dev mode (no auth) |

### Auth Modes

- **Dev mode** (empty `CF_ACCESS_TEAM_DOMAIN`): All requests allowed, `auth.email` = `dev@localhost`
- **Production**: Requests must include `Cf-Access-Jwt-Assertion` header with valid CF Access JWT. Protected routes (PATCH status, DELETE, POST projects) require a verified email.

### Integrating the SDK into a Client App

```tsx
// 1. Install
pnpm add @pinpoint/react

// 2. Import styles in your entry point
import "@pinpoint/react/styles.css";

// 3. Wrap your app
import { PinpointProvider, usePinpoint } from "@pinpoint/react";

function PinpointButton() {
  const { isActive, toggle } = usePinpoint();
  return (
    <button data-pinpoint-overlay data-pinpoint-popover onClick={toggle}>
      {isActive ? "Close" : "Pinpoint"}
    </button>
  );
}

export function App() {
  return (
    <PinpointProvider
      endpoint="https://your-worker.workers.dev/api/v1/feedback"
      projectId="your-project-slug-or-id"
      captureMethod="html2canvas"   // or "native"
      theme="auto"                   // "light" | "dark" | "auto"
    >
      <YourApp />
      <PinpointButton />
    </PinpointProvider>
  );
}
```

**Key points:**
- `data-pinpoint-overlay` prevents elements from being highlighted; `data-pinpoint-popover` restores `pointer-events` under modal `react-remove-scroll` — use both on a floating toggle
- `projectId` can be a project slug or nanoid — the worker resolves slugs to IDs automatically
- The SDK sends `multipart/form-data` with three fields: `metadata` (JSON string), `screenshot` (PNG blob), `dom-snapshot` (JSON blob)

## API Reference

All endpoints are under `/api/v1/`. CORS headers are set on all `/api/*` routes.

### Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/feedback` | No | Submit feedback (multipart/form-data) |
| `GET` | `/feedback` | No | List feedback (cursor pagination) |
| `GET` | `/feedback/:id` | No | Get single feedback item |
| `PATCH` | `/feedback/:id/status` | Yes | Update status (`resolved`, `dismissed`) |
| `DELETE` | `/feedback/:id` | Yes | Soft-delete feedback |
| `GET` | `/feedback/:id/screenshot` | No | Get screenshot PNG from R2 |
| `GET` | `/feedback/:id/dom-snapshot` | No | Get DOM snapshot JSON from R2 |

### Projects

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/projects` | No | List all projects |
| `POST` | `/projects` | Yes | Create a project |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Returns `{ status: "ok" }` |

### Query Parameters (GET /feedback)

| Param | Type | Description |
|---|---|---|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Items per page (1–100, default 25) |
| `status` | string | Filter by status (`open`, `resolved`, `dismissed`, `deleted`) |
| `category` | string | Filter by category (`bug`, `suggestion`, `question`, `other`) |
| `projectId` | string | Filter by project ID or slug |
| `includeDeleted` | boolean | Include soft-deleted items (default false) |

### POST /feedback FormData Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata` | string (JSON) | Yes | `FeedbackMetadata` object |
| `screenshot` | file (PNG) | No | Screenshot captured by SDK |
| `dom-snapshot` | file/blob (JSON) | No | Serialized DOM tree |

### POST /projects Body

```json
{ "name": "My App", "slug": "my-app" }
```

Returns `409` if slug already exists.

## Database Schema

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | nanoid |
| `name` | TEXT NOT NULL | |
| `slug` | TEXT UNIQUE NOT NULL | Human-readable identifier, also accepted as `projectId` in feedback submission |
| `created_at` | TEXT | ISO timestamp, auto-generated |

### `feedback`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | nanoid |
| `project_id` | TEXT FK → projects.id | |
| `status` | TEXT | `open` (default), `resolved`, `dismissed`, `deleted` |
| `category` | TEXT | `bug`, `suggestion`, `question`, `other`, or NULL |
| `comment` | TEXT NOT NULL | Max 2000 chars |
| `selector` | TEXT | CSS selector of highlighted element |
| `url` | TEXT | Page URL |
| `viewport_width` | INTEGER | |
| `viewport_height` | INTEGER | |
| `user_agent` | TEXT | |
| `created_by` | TEXT | Email from CF Access JWT, or `anonymous` |
| `capture_method` | TEXT | `html2canvas` or `native` |
| `created_at` | TEXT | Auto-generated |
| `updated_at` | TEXT | Auto-updated on status change |
| `deleted_at` | TEXT | Set when soft-deleted |

**Indexes:** `project_id`, `status`, `created_at`, `(project_id, status)`

### R2 Keys

- `feedback/{id}/screenshot.png` — PNG image
- `feedback/{id}/dom-snapshot.json` — serialized DOM tree

## Backend Integration Patterns

The SDK sends `multipart/form-data` to any HTTP endpoint that implements the contract below. While `@pinpoint/worker` provides a ready-made Cloudflare Worker implementation, you can integrate Pinpoint's backend into any server framework.

### SDK Contract

The SDK POSTs `multipart/form-data` with three fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata` | string (JSON) | Yes | `FeedbackMetadata` object — see `@pinpoint/shared` types |
| `screenshot` | Blob (PNG) | No | Screenshot captured by SDK |
| `dom-snapshot` | Blob (JSON) | No | Serialized DOM tree |

Your server should return `201 { id: string }` on success.

For binary retrieval, implement GET endpoints that stream assets from object storage:

- `GET /feedback/:id/screenshot` → PNG image
- `GET /feedback/:id/dom-snapshot` → JSON document

### Pattern A: Standalone Pinpoint Worker

Deploy `@pinpoint/worker` as a standalone Cloudflare Worker. This is the default approach documented in the Deployment section above. Best for greenfield projects or when you want Pinpoint completely self-contained.

```
Frontend SDK → Pinpoint Worker (Hono) → D1 + R2
Dashboard  → Pinpoint Worker (Hono) → D1 + R2
```

### Pattern B: Embedded in Existing API

Add Pinpoint's REST and admin routes to an existing API server. This is the recommended pattern when you already have a Cloudflare Worker (or any server) with its own D1 database and R2 buckets.

**Why embedded?**
- Single deployment / single D1 database / single set of wrangler env vars
- Admin page uses your existing auth (tRPC admin routes, session middleware)
- No separate worker to maintain

**Architecture:**

```
Frontend SDK → Your API (REST routes)  → D1 + R2
Admin App    → Your API (tRPC routes)   → D1 + R2
              ↓
         @pinpoint/shared (validators, types)
```

**Required REST routes** (the SDK can't use tRPC/GraphQL because it sends multipart/form-data):

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/feedback` | No | Submit feedback (multipart/form-data) |
| `GET` | `/api/v1/feedback/:id/screenshot` | No | Stream screenshot PNG from R2/S3 |
| `GET` | `/api/v1/feedback/:id/dom-snapshot` | No | Stream DOM snapshot JSON from R2/S3 |
| `GET` | `/api/v1/projects` | No | List projects |
| `POST` | `/api/v1/projects` | Optional | Create project |

**Admin query/mutation routes** (use your existing pattern — tRPC, GraphQL, REST, etc.):

| Route | Type | Description |
|---|---|---|
| `admin.pinpoint.list` | Query | Paginated feedback list with filters (projectId, status, category, offset/limit) |
| `admin.pinpoint.getById` | Query | Single feedback item with screenshotUrl/domSnapshotUrl |
| `admin.pinpoint.updateStatus` | Mutation | Resolve or dismiss feedback |
| `admin.pinpoint.delete` | Mutation | Soft-delete feedback |
| `admin.pinpoint.listProjects` | Query | List projects for filter dropdown |
| `admin.pinpoint.createProject` | Mutation | Create project |

**CORS:** The REST routes must include CORS headers since SDK submissions come from different origins. Match your existing API CORS policy or use `Access-Control-Allow-Origin: *` for development.

**Implementing the POST handler:**

1. Parse `multipart/form-data`
2. Validate `metadata` with `validateFeedbackMetadata` from `@pinpoint/shared`
3. (Optional) Validate `dom-snapshot` with `validateDOMSnapshot` from `@pinpoint/shared`
4. Resolve `projectId` — if it's a slug, look up the project table to get the nanoid ID. Auto-create the project if the slug doesn't exist yet
5. Generate ID, store screenshot + DOM snapshot in R2/S3, insert feedback row in D1/SQL
6. Return `201 { id }`

**Implementing the admin list endpoint:**

Return offset-based pagination (matching your admin UI pattern) with this shape:
```ts
{ items: FeedbackItem[], total: number, page: number, totalPage: number }
```

Each `FeedbackItem` should include a `screenshotUrl` field — either a full URL or a path that the admin app can prepend with the API base URL.

### Pattern C: Custom Server

Any HTTP server that implements the SDK contract can work. The key requirements:

1. Accept `multipart/form-data` POST at your configured endpoint
2. Validate metadata with `@pinpoint/shared` validators
3. Store binary assets (screenshot, DOM snapshot) in object storage
4. Store metadata in a database following the schema below
5. Provide GET endpoints for binary asset retrieval
6. Provide admin endpoints for listing, viewing, and managing feedback

### Database Schema

The schema is database-agnostic. Implement it in whatever ORM your project uses. The logical model:

**`projects` table:**
- `id` (primary key, string) — nanoid or UUID
- `name` (not null, string)
- `slug` (unique, not null, string) — human-readable identifier, also accepted as `projectId` in feedback submission
- `created_at` (not null, timestamp)

**`feedback` table:**
- `id` (primary key, string) — nanoid or UUID
- `project_id` (foreign key → projects.id, not null)
- `status` (not null, default 'open') — one of: `open`, `resolved`, `dismissed`, `deleted`
- `category` (nullable) — one of: `bug`, `suggestion`, `question`, `other`
- `comment` (not null, string, max 2000 chars)
- `selector` (nullable, string) — CSS selector of highlighted element
- `url` (nullable, string) — page URL
- `viewport_width` (nullable, integer)
- `viewport_height` (nullable, integer)
- `user_agent` (nullable, string)
- `created_by` (default 'anonymous', string) — email from auth or 'anonymous'
- `capture_method` (default 'html2canvas', string) — `html2canvas` or `native`
- `created_at` (not null, timestamp)
- `updated_at` (not null, timestamp)
- `deleted_at` (nullable, timestamp) — set when soft-deleted

**Indexes:** `project_id`, `status`, `created_at`, `(project_id, status)`

**Drizzle ORM example** (for projects using Drizzle with SQLite/D1):

```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const pinpointProjects = sqliteTable('pinpoint_projects', {
  id: text().primaryKey().$default(() => randomUUID()),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
});

export const pinpointFeedback = sqliteTable('pinpoint_feedback', {
  id: text().primaryKey().$default(() => randomUUID()),
  projectId: text('project_id').notNull(),
  status: text().notNull().default('open'),
  category: text(),
  comment: text().notNull(),
  selector: text(),
  url: text(),
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  userAgent: text('user_agent'),
  createdBy: text('created_by').default('anonymous'),
  captureMethod: text('capture_method').default('html2canvas'),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$default(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_pinpoint_feedback_project_id').on(table.projectId),
  index('idx_pinpoint_feedback_status').on(table.status),
  index('idx_pinpoint_feedback_created_at').on(table.createdAt),
  index('idx_pinpoint_feedback_project_status').on(table.projectId, table.status),
]);
```

### Object Storage Keys

Regardless of backend, use this key layout in R2/S3:

- `feedback/{id}/screenshot.png` — PNG image
- `feedback/{id}/dom-snapshot.json` — JSON document

### Input Validation

Use `@pinpoint/shared` validators regardless of your backend framework:

```ts
import { validateFeedbackMetadata, validateDOMSnapshot } from '@pinpoint/shared';

// In your POST /feedback handler:
const metadataValidation = validateFeedbackMetadata(metadataObj);
if (!metadataValidation.valid) {
  return { status: 400, body: { error: metadataValidation.error } };
}

const snapshotValidation = validateDOMSnapshot(domSnapshotObj);
if (!snapshotValidation.valid) {
  return { status: 400, body: { error: snapshotValidation.error } };
}
```

## Extending the System

### Adding a new feedback field

1. **Shared types** (`packages/shared/src/types.ts`): Add the field to `FeedbackMetadata` and `FeedbackItem`
2. **Shared validators** (`packages/shared/src/validators.ts`): Add validation rules
3. **Worker migration**: Create `packages/worker/migrations/0003_add_field.sql`
4. **Worker repo** (`packages/worker/src/db/feedback-repo.ts`): Add column to `FeedbackRow` and INSERT/SELECT
5. **Worker routes** (`packages/worker/src/routes/feedback.ts`): Pass through new field
6. **SDK** (`packages/react/src/FeedbackSubmitter.ts`): Include in metadata
7. **Dashboard** (`packages/dashboard/src/api/client.ts`): Add to `FeedbackItem` type

### Adding a new API endpoint

**For the standalone worker:**

1. Create route handler in `packages/worker/src/routes/`
2. Mount in `packages/worker/src/index.ts`
3. Add tests in `packages/worker/src/routes/__tests__/`
4. Update mock worker (`packages/mock-worker/src/routes.ts`) to stub the endpoint
5. Add client method in `packages/dashboard/src/api/client.ts`
6. Add TanStack Query hook in `packages/dashboard/src/api/hooks.ts`

**For embedded backends:**

1. Add the new field/column to your schema and database (follow the Drizzle ORM example above or use raw SQL)
2. Update the REST route handler if the SDK contract changes
3. Add admin tRPC/GraphQL/REST routes for the admin viewer
4. Update `@pinpoint/shared` types if the SDK metadata format changes

### Changing auth requirements

- **Remove auth on an endpoint**: Remove the `if (auth.email === null)` check in the route handler
- **Add auth to an endpoint**: Add `requireAuthMiddleware` or inline `auth.email === null` check
- **Dev mode**: Empty `CF_ACCESS_TEAM_DOMAIN` in wrangler.toml → all requests get `dev@localhost` email

## Testing

```bash
# All packages
pnpm test:run

# Specific package
cd packages/worker && pnpm test:run
cd packages/react && pnpm test:run
cd packages/dashboard && pnpm test:run

# Type check
pnpm typecheck
```

### Worker test patterns

- D1: Use mock `D1Database` with `prepare().bind().first()/all()` chains
- R2: Use mock `R2Bucket` with in-memory `Map`
- Auth: Mock `jose.jwtVerify` and `fetch` for JWKS
- Routes: Create Hono app with middleware injecting env + auth context

## Common Tasks

| Task | Command |
|---|---|
| Start worker locally | `cd packages/worker && wrangler dev --config wrangler.toml --port 8787` |
| Start dashboard locally | `cd packages/dashboard && pnpm dev` |
| Apply D1 migrations | `wrangler d1 migrations apply feedback-db --local --config wrangler.toml` |
| Create new migration | `wrangler d1 migrations create feedback-db <name> --config wrangler.toml` |
| Build dashboard for prod | `cd packages/dashboard && pnpm build` |
| Deploy worker | `cd packages/worker && wrangler deploy` |