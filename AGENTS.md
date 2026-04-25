# @pinpoint — Agent Reference

Pinpoint is a feedback SDK that lets users highlight any DOM element in a web app, capture a screenshot and DOM snapshot, and submit a comment. The backend stores submissions in Cloudflare D1 + R2 and exposes a dashboard for reviewing, resolving, and deleting feedback.

## Monorepo Structure

| Package | Path | Description |
|---|---|---|
| `@pinpoint/shared` | `packages/shared/` | Types, validators, constants shared across all packages — [AGENTS.md](packages/shared/AGENTS.md) |
| `@pinpoint/react` | `packages/react/` | React SDK: highlight overlay, comment form, screenshot capture — [AGENTS.md](packages/react/AGENTS.md) |
| `@pinpoint/worker` | `packages/worker/` | Hono Cloudflare Worker: REST API, D1 storage, R2 assets, auth — [AGENTS.md](packages/worker/AGENTS.md) |
| `@pinpoint/dashboard` | `packages/dashboard/` | React admin SPA: feedback list/detail, project management — [AGENTS.md](packages/dashboard/AGENTS.md) |
| `@pinpoint/mock-worker` | `packages/mock-worker/` | In-memory Hono mock of the worker API for local SDK development |

## Architecture

```
@pinpoint/shared          @pinpoint/react           @pinpoint/worker           @pinpoint/dashboard
┌─────────────────┐      ┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ types.ts         │◄─────│ PinpointProvider  │    │ Hono CF Worker     │    │ React SPA (Vite)    │
│ validators.ts    │      │ HighlightOverlay  │───▶│ ├─ auth/jwt.ts     │◄───│ ├─ views/           │
│ constants        │      │ CommentPopover    │    │ ├─ middleware/cors  │    │ ├─ components/      │
└─────────────────┘      │ ScreenshotCapture │    │ ├─ routes/feedback │    │ └─ api/ hooks       │
                          │ DOMSerializer     │    │ ├─ routes/projects │    └─────────────────────┘
                          │ FeedbackSubmitter │    │ ├─ db/ repos       │
                          └───────────────────┘   │ └─ storage/r2      │
                                                   └────────────────────┘
```

**Data flow:** User highlights element → SDK captures screenshot + DOM snapshot → POSTs multipart/form-data to worker → worker validates via `@pinpoint/shared`, stores screenshot/DOM in R2, inserts metadata in D1 → dashboard queries worker API.

## Workspace Commands

```bash
pnpm test:run      # run all tests across all packages
pnpm typecheck     # type-check all packages
pnpm build         # build all packages (via Turbo)
```

To run the full stack locally:

```bash
# Terminal 1 — Worker (port 8787)
cd packages/worker && wrangler dev --config wrangler.toml --port 8787

# Terminal 2 — Dashboard (port 5173, proxies /api → 8787)
cd packages/dashboard && pnpm dev
```

## Extending the System

### Adding a new feedback field

This workflow touches all packages in order:

1. **`packages/shared/src/types.ts`** — Add the field to `FeedbackMetadata` and `FeedbackItem`
2. **`packages/shared/src/validators.ts`** — Add validation rules
3. **`packages/worker/migrations/`** — Create a new SQL migration file
4. **`packages/worker/src/db/feedback-repo.ts`** — Add column to `FeedbackRow` and INSERT/SELECT
5. **`packages/worker/src/routes/feedback.ts`** — Pass through the new field
6. **`packages/react/src/FeedbackSubmitter.ts`** — Include the field in submitted metadata
7. **`packages/dashboard/src/api/client.ts`** — Add the field to the `FeedbackItem` type

## Commit Guidelines

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

Types: feat, fix, docs, refactor, test, chore
Scopes: react, worker, dashboard, shared (match the package name)

Examples:
  feat(react): add keyboard shortcut to toggle overlay
  fix(worker): handle missing screenshot field gracefully
  docs: update deployment steps for wrangler v3
```
