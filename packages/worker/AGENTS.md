# @pinpoint/worker — Agent Reference

Hono-based Cloudflare Worker. Handles feedback submission, D1 database storage, R2 asset storage, Cloudflare Access JWT auth, and CORS. Also serves the dashboard SPA as static assets in production.

## Commands

```bash
wrangler dev --config wrangler.toml --port 8787   # local dev
pnpm build                                          # tsc → dist/
pnpm test:run                                       # vitest run
pnpm typecheck                                      # tsc --noEmit
wrangler deploy                                     # deploy to Cloudflare
wrangler d1 migrations apply feedback-db --local --config wrangler.toml   # apply DB migrations locally
wrangler d1 migrations create feedback-db <name> --config wrangler.toml   # create new migration
```

## Source Layout

| File | Purpose |
|---|---|
| `src/index.ts` | App entry — mounts CORS middleware, auth middleware, feedback and project routes |
| `src/routes/feedback.ts` | All `/feedback` endpoints |
| `src/routes/projects.ts` | All `/projects` endpoints |
| `src/db/feedback-repo.ts` | D1 CRUD: `createFeedback`, `listFeedback`, `getFeedbackById`, `updateFeedbackStatus`, `softDeleteFeedback` |
| `src/db/projects-repo.ts` | D1: `getProjectBySlug` |
| `src/storage/r2.ts` | R2 ops: `storeScreenshot`, `storeDOMSnapshot`, `getScreenshot`, `getDOMSnapshot` |
| `src/auth/jwt.ts` | Cloudflare Access JWT verification; sets `auth.email` on context |
| `src/middleware/cors.ts` | CORS headers from `ALLOWED_ORIGINS` env var |
| `migrations/` | SQL migration files for D1 |

## Configuration

### wrangler.toml vars

| Variable | Required | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | Yes | Comma-separated origins for CORS, or `*` for any |
| `CF_ACCESS_TEAM_DOMAIN` | No | Cloudflare Access team domain. Empty = dev mode (no auth) |

### Auth Modes

- **Dev mode** (`CF_ACCESS_TEAM_DOMAIN` empty): all requests pass, `auth.email` = `dev@localhost`
- **Production**: requests must carry `Cf-Access-Jwt-Assertion` header with valid CF Access JWT

### Security Notes

- Never deploy with an empty `CF_ACCESS_TEAM_DOMAIN` in production — dev mode disables all auth.
- `ALLOWED_ORIGINS: *` is acceptable in development; restrict to specific origins in production.
- `POST /feedback` is intentionally unauthenticated (end-users submit without logging in). Only `PATCH /feedback/:id/status`, `DELETE /feedback/:id`, and `POST /projects` require auth.

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
| `GET` | `/feedback/:id/screenshot` | No | Stream screenshot PNG from R2 |
| `GET` | `/feedback/:id/dom-snapshot` | No | Stream DOM snapshot JSON from R2 |

### Projects

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/projects` | No | List all projects |
| `POST` | `/projects` | Yes | Create a project (`{ name, slug }` — returns `409` if slug exists) |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` |

### Query Parameters (GET /feedback)

| Param | Type | Description |
|---|---|---|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Items per page (1–100, default 25) |
| `status` | string | `open`, `resolved`, `dismissed`, `deleted` |
| `category` | string | `bug`, `suggestion`, `question`, `other` |
| `projectId` | string | Filter by project ID or slug |
| `includeDeleted` | boolean | Include soft-deleted items (default false) |

### POST /feedback FormData Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata` | string (JSON) | Yes | `FeedbackMetadata` object |
| `screenshot` | file (PNG) | No | Screenshot captured by SDK |
| `dom-snapshot` | file/blob (JSON) | No | Serialized DOM tree |

## Database Schema

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | nanoid |
| `name` | TEXT NOT NULL | |
| `slug` | TEXT UNIQUE NOT NULL | Also accepted as `projectId` in feedback submissions |
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
| `capture_method` | TEXT | `dom` or `native` |
| `created_at` | TEXT | Auto-generated |
| `updated_at` | TEXT | Auto-updated on status change |
| `deleted_at` | TEXT | Set when soft-deleted |

**Indexes:** `project_id`, `status`, `created_at`, `(project_id, status)`

### R2 Keys

- `feedback/{id}/screenshot.png`
- `feedback/{id}/dom-snapshot.json`

## Deployment

### First-time setup

```bash
# Create D1 database — copy database_id into wrangler.toml
wrangler d1 create feedback-db

# Create R2 bucket
wrangler r2 bucket create feedback-assets

# Apply migrations
wrangler d1 migrations apply feedback-db --local --config wrangler.toml
```

### Production deploy

```bash
# Build dashboard first (worker serves it as static assets)
cd packages/dashboard && pnpm build

# Deploy worker
cd packages/worker && wrangler deploy
```

Uncomment the `[assets]` block in `wrangler.toml` for production SPA serving:

```toml
[assets]
directory = "../dashboard/dist"
run_worker_first = ["/api/*"]
not_found_handling = "single-page-application"
```

## Testing

```bash
pnpm test:run
```

**Patterns:**
- D1: mock `D1Database` with `prepare().bind().first()/all()` chains
- R2: mock `R2Bucket` with an in-memory `Map`
- Auth: mock `jose.jwtVerify` and `fetch` for JWKS
- Routes: create Hono app with middleware injecting env + auth context

Tests live in `src/routes/__tests__/`.

## Extending

### Adding a new endpoint

1. Create route handler in `src/routes/`
2. Mount in `src/index.ts`
3. Add tests in `src/routes/__tests__/`
4. Update mock worker (`packages/mock-worker/src/routes.ts`) to stub the endpoint
5. Add client method in `packages/dashboard/src/api/client.ts`
6. Add TanStack Query hook in `packages/dashboard/src/api/hooks.ts`

### Changing auth on an endpoint

- **Remove auth**: remove the `if (auth.email === null)` check in the route handler
- **Add auth**: add `requireAuthMiddleware` or inline `auth.email === null` check

## Backend Integration Patterns

The worker implements one backend pattern. If you're embedding Pinpoint into an existing API instead, use these patterns.

### SDK Contract

The SDK POSTs `multipart/form-data` with three fields (`metadata`, `screenshot`, `dom-snapshot`) and expects `201 { id: string }` on success. Binary retrieval requires:

- `GET /feedback/:id/screenshot` → PNG
- `GET /feedback/:id/dom-snapshot` → JSON

### Pattern A: Standalone Pinpoint Worker

Deploy `@pinpoint/worker` as its own Cloudflare Worker (default). Best for greenfield or self-contained setups.

### Pattern B: Embedded in Existing API

Add Pinpoint routes to an existing server. Recommended when you already have a D1 database and R2 bucket.

**Required REST routes:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/feedback` | Submit feedback (multipart/form-data) |
| `GET` | `/api/v1/feedback/:id/screenshot` | Stream screenshot PNG |
| `GET` | `/api/v1/feedback/:id/dom-snapshot` | Stream DOM snapshot JSON |
| `GET` | `/api/v1/projects` | List projects |
| `POST` | `/api/v1/projects` | Create project |

**Admin routes** (use your existing pattern — tRPC, GraphQL, REST):

| Route | Type | Description |
|---|---|---|
| `admin.pinpoint.list` | Query | Paginated feedback list with filters |
| `admin.pinpoint.getById` | Query | Single item with `screenshotUrl`/`domSnapshotUrl` |
| `admin.pinpoint.updateStatus` | Mutation | Resolve or dismiss |
| `admin.pinpoint.delete` | Mutation | Soft-delete |
| `admin.pinpoint.listProjects` | Query | Projects for filter dropdown |
| `admin.pinpoint.createProject` | Mutation | Create project |

**POST handler steps:**
1. Parse `multipart/form-data`
2. Validate `metadata` with `validateFeedbackMetadata` from `@pinpoint/shared`
3. (Optional) Validate `dom-snapshot` with `validateDOMSnapshot`
4. Resolve `projectId` slug → nanoid (auto-create project if slug is unknown)
5. Store screenshot + DOM snapshot in R2/S3; insert feedback row
6. Return `201 { id }`

**Admin list response shape:**
```ts
{ items: FeedbackItem[], total: number, page: number, totalPage: number }
```

**Drizzle ORM example** (SQLite/D1):

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
  captureMethod: text('capture_method').default('dom'),
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

### Pattern C: Custom Server

Any HTTP server works as long as it accepts `multipart/form-data` POST, validates via `@pinpoint/shared`, stores binaries in object storage, and provides GET endpoints for retrieval. Use the same R2 key layout: `feedback/{id}/screenshot.png` and `feedback/{id}/dom-snapshot.json`.

**Input validation:**

```ts
import { validateFeedbackMetadata, validateDOMSnapshot } from '@pinpoint/shared';

const metadataValidation = validateFeedbackMetadata(metadataObj);
if (!metadataValidation.valid) {
  return { status: 400, body: { error: metadataValidation.error } };
}
```
