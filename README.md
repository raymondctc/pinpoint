# @pinpoint

A modular Pinpoint SDK for React apps. Lets users highlight elements, leave comments, and submit annotated screenshots and DOM snapshots to your server.

## Packages

| Package | Description |
|---|---|
| [`@pinpoint/shared`](./packages/shared) | Types, constants, and validators — framework-agnostic |
| [`@pinpoint/react`](./packages/react) | React SDK — `PinpointProvider`, `HighlightOverlay`, `CommentPopover`, screenshot capture, DOM serialization, and submission |
| [`@pinpoint/worker`](./packages/worker) | Cloudflare Worker backend — D1 + R2 + CF Access auth |
| [`@pinpoint/dashboard`](./packages/dashboard) | React SPA for reviewing submitted feedback |
| `@pinpoint/mock-worker` | Dev-only Cloudflare Worker that stubs the backend API |

**For agent-facing integration details, see [AGENTS.md](./AGENTS.md).**

## Quick Start

### 1. Install

```bash
pnpm add @pinpoint/react
```

### 2. Import styles

In your app entry point (e.g. `app/layout.tsx`, `src/main.tsx`):

```tsx
import "@pinpoint/react/styles.css";
```

### 3. Wrap your app

```tsx
import { PinpointProvider, usePinpoint } from "@pinpoint/react";

function PinpointButton() {
  const { isActive, toggle } = usePinpoint();
  return (
    <button
      data-pinpoint-overlay
      onClick={toggle}
      className="fixed bottom-4 right-4 z-[999990] rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      {isActive ? "Close Pinpoint" : "Pinpoint"}
    </button>
  );
}

export function App() {
  return (
    <PinpointProvider endpoint="/api/v1/feedback" projectId="my-project">
      <YourApp />
      <PinpointButton />
    </PinpointProvider>
  );
}
```

That's it. Clicking the button activates Pinpoint mode — users highlight an element, leave a comment, and the SDK handles the rest.

### 4. Run the backend locally

```bash
# Start the worker (port 8787)
cd packages/worker
wrangler d1 migrations apply feedback-db --local --config wrangler.toml  # first time only
wrangler dev --config wrangler.toml --port 8787

# Start the dashboard (port 5173, proxies /api → 8787)
cd packages/dashboard
pnpm dev
```

Point the SDK at the worker:

```tsx
<PinpointProvider
  endpoint="http://localhost:8787/api/v1/feedback"
  projectId="your-project-slug"
/>
```

## API Reference

### `<PinpointProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | — | **Required.** URL the SDK POSTs feedback to |
| `projectId` | `string` | — | **Required.** Project slug or ID (worker resolves slugs to IDs) |
| `categories` | `FeedbackCategory[]` | `['bug','suggestion','question','other']` | Category picker options |
| `captureMethod` | `'dom' \| 'native'` | `'dom'` | Screenshot capture method |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | UI theme |
| `exclude` | `string[]` | `[]` | CSS selectors excluded from highlighting |
| `children` | `ReactNode` | — | App content |

### `usePinpoint()`

Returns `{ isActive: boolean; toggle: () => void; config: PinpointProviderConfig }`.

### `data-pinpoint-overlay`

Add this attribute to any element that should **not** be highlighted when Pinpoint mode is active.

### `data-pinpoint-popover`

Under Radix Dialog / Sheet, `react-remove-scroll` can set `pointer-events: none` on `<body>`. The SDK’s CSS re-enables clicks for `[data-pinpoint-popover]` and its descendants. Use **both** attributes on a floating toggle so it stays clickable and excluded from highlight:

```tsx
<button data-pinpoint-overlay data-pinpoint-popover onClick={toggle}>
  Pinpoint
</button>
```

### Exports

```ts
import { PinpointProvider, usePinpoint } from "@pinpoint/react";
import { HighlightOverlay, CommentPopover } from "@pinpoint/react";
import { captureScreenshot, serializeDOM, generateSelector, submitFeedback } from "@pinpoint/react";
import "@pinpoint/react/styles.css";
```

## Backend Contract

The SDK POSTs `multipart/form-data` to your `endpoint` with:

| Field | Type | Description |
|---|---|---|
| `metadata` | `string` (JSON) | `FeedbackMetadata` object — see `@pinpoint/shared` types |
| `screenshot` | `Blob` (PNG) | Screenshot of the selected element |
| `dom-snapshot` | `Blob` (JSON) | Serialized DOM tree of the selected element |

Your server should return `201 { id: string }` on success.

The `@pinpoint/worker` package provides a full Cloudflare Worker implementation. See [AGENTS.md](./AGENTS.md) for deployment and configuration details.

### Example server handler (Next.js App Router)

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const metadata = formData.get("metadata");
  const screenshot = formData.get("screenshot");
  const domSnapshot = formData.get("dom-snapshot");

  if (!metadata) {
    return NextResponse.json({ error: "metadata is required" }, { status: 400 });
  }

  // Persist to your database / object storage here

  return NextResponse.json({ id: crypto.randomUUID() }, { status: 201 });
}
```

## Backend Integration

The Pinpoint SDK works with any HTTP backend that accepts `multipart/form-data` POST requests. While `@pinpoint/worker` provides a ready-made Cloudflare Worker (Hono), you can also embed Pinpoint into existing APIs — including tRPC, itty-router, or any other framework.

Key points for embedded integration:
- The SDK POST endpoint must accept multipart/form-data (tRPC can't handle this — use REST routes alongside your existing API)
- Admin queries/mutations can use your existing pattern (tRPC, GraphQL, REST)
- Use `@pinpoint/shared` validators for input validation regardless of framework
- Follow the same database schema and R2/S3 key layout

See [AGENTS.md](./AGENTS.md#backend-integration-patterns) for detailed integration patterns, schema examples (including Drizzle ORM), and architecture diagrams.

## Screenshot Capture

The SDK uses [modern-screenshot](https://github.com/qq15725/modern-screenshot) for screenshot capture (the `dom` method). It renders DOM nodes via SVG foreignObject and produces a PNG blob. The library is lightweight (~35KB min) and supports filtering nodes, custom backgrounds, and DPI scaling.

## Monorepo Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test:run         # Run tests
pnpm typecheck        # Type check
```

### Linking locally

To use `@pinpoint/react` in another project during development, add a `link:` dependency:

```json
{
  "dependencies": {
    "@pinpoint/react": "link:./path/to/pinpoint/packages/react",
    "@pinpoint/shared": "link:./path/to/pinpoint/packages/shared"
  }
}
```

## Architecture

```
@pinpoint/shared     @pinpoint/react          @pinpoint/worker          @pinpoint/dashboard
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐   ┌─────────────────┐
│ types.ts     │◄────│ PinpointProvider   │     │ Hono CF Worker      │   │ React SPA        │
│ validators   │     │ HighlightOverlay │────▶│ D1 + R2 + Auth     │◄──│ TanStack Query    │
│ constants    │     │ CommentPopover   │     │ REST API            │   │ React Router      │
└─────────────┘     │ ScreenshotCapture│     │ Dashboard assets     │   └─────────────────┘
                     │ DOMSerializer    │     └────────────────────┘
                     │ FeedbackSubmitter│
                     └──────────────────┘
```

**Flow:** User clicks toggle → `HighlightOverlay` lets them pick an element → border-click selects it → `CommentPopover` collects comment + category → `captureScreenshot` + `serializeDOM` capture evidence → `submitFeedback` POSTs to endpoint → worker stores in D1 + R2 → dashboard reviews submissions.

## License

MIT