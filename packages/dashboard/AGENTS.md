# @pinpoint/dashboard — Agent Reference

React admin SPA (Vite + TanStack Query + React Router). Displays feedback submissions, lets admins resolve/dismiss/delete items, and manages projects. In development it proxies `/api` to the worker at `localhost:8787`. In production the worker serves this app as static assets.

## Commands

```bash
pnpm dev          # Vite dev server at :5173 (proxies /api → :8787)
pnpm build        # tsc --noEmit && vite build → dist/
pnpm preview      # preview the production build
pnpm test:run     # vitest run
pnpm typecheck    # tsc --noEmit
```

## Source Layout

### Views (`src/views/`)

| File | Route | Purpose |
|---|---|---|
| `FeedbackList.tsx` | `/` | Paginated feedback list with status/category filters |
| `FeedbackDetail.tsx` | `/feedback/:id` | Single feedback item — screenshot, DOM tree, status actions |
| `ProjectList.tsx` | `/projects` | List projects, create new project |

### Components (`src/components/`)

| File | Purpose |
|---|---|
| `StatusBadge.tsx` | Color-coded status pill |
| `CategoryBadge.tsx` | Color-coded category pill |
| `ScreenshotViewer.tsx` | Renders feedback screenshot image |
| `DOMSnapshotRenderer.tsx` | Renders the serialized DOM tree |
| `FilterBar.tsx` | Status/category/project filter controls |
| `StatusActions.tsx` | Resolve, dismiss, delete buttons |
| `PaginationControls.tsx` | Cursor-based pagination UI |
| `CreateProjectForm.tsx` | New project form (name + slug) |

### API Layer (`src/api/`)

- **`client.ts`** — thin `fetch` wrapper; defines `FeedbackItem` type used throughout the app; all API calls go through here
- **`hooks.ts`** — TanStack Query hooks: `useFeedbackList`, `useFeedbackDetail`, `useUpdateFeedbackStatus`, `useDeleteFeedback`, `useProjects`, `useCreateProject`

## Patterns

**Data fetching:** all server state goes through TanStack Query hooks in `src/api/hooks.ts`. Add a new hook there for any new query or mutation; don't fetch directly in components.

**Adding a new view:**
1. Create the view component in `src/views/`
2. Add a route in `src/App.tsx`
3. Add a nav link if needed
4. Add any new API calls to `src/api/client.ts` and a hook to `src/api/hooks.ts`

**Adding a field from the API:**
1. Add it to the `FeedbackItem` type in `src/api/client.ts`
2. Display it in the relevant view or component
3. See the [cross-package walkthrough](../../AGENTS.md#adding-a-new-feedback-field) at the root for the full chain
