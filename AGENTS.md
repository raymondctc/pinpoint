# @pinpoint — Agent Reference

Agent-facing integration guide for the Feedback SDK backend. Use this file to understand how to deploy, configure, and extend the system.

## Architecture

```
@pinpoint/shared          @pinpoint/react           @pinpoint/worker           @pinpoint/dashboard
┌─────────────────┐      ┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ types.ts         │◄─────│ FeedbackProvider    │    │ Hono CF Worker      │    │ React SPA (Vite)   │
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
import { FeedbackProvider, useFeedback } from "@pinpoint/react";

function FeedbackButton() {
  const { isActive, toggle } = useFeedback();
  return (
    <button data-feedback-overlay onClick={toggle}>
      {isActive ? "Close" : "Feedback"}
    </button>
  );
}

export function App() {
  return (
    <FeedbackProvider
      endpoint="https://your-worker.workers.dev/api/v1/feedback"
      projectId="your-project-slug-or-id"
      captureMethod="html2canvas"   // or "native"
      theme="auto"                   // "light" | "dark" | "auto"
    >
      <YourApp />
      <FeedbackButton />
    </FeedbackProvider>
  );
}
```

**Key points:**
- `data-feedback-overlay` attribute prevents elements from being highlighted (toggle buttons, modals, etc.)
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

1. Create route handler in `packages/worker/src/routes/`
2. Mount in `packages/worker/src/index.ts`
3. Add tests in `packages/worker/src/routes/__tests__/`
4. Update mock worker (`packages/mock-worker/src/routes.ts`) to stub the endpoint
5. Add client method in `packages/dashboard/src/api/client.ts`
6. Add TanStack Query hook in `packages/dashboard/src/api/hooks.ts`

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