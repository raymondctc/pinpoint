# @feedback

A modular feedback collection SDK for React apps. Lets users highlight elements, leave comments, and submit annotated screenshots and DOM snapshots to your server.

## Packages

| Package | Description |
|---|---|
| [`@feedback/shared`](./packages/shared) | Types, constants, and validators — framework-agnostic |
| [`@feedback/react`](./packages/react) | React SDK — `FeedbackProvider`, `HighlightOverlay`, `CommentPopover`, screenshot capture, DOM serialization, and submission |
| [`@feedback/worker`](./packages/worker) | Cloudflare Worker backend — D1 + R2 + CF Access auth |
| [`@feedback/dashboard`](./packages/dashboard) | React SPA for reviewing submitted feedback |
| `@feedback/mock-worker` | Dev-only Cloudflare Worker that stubs the backend API |

**For agent-facing integration details, see [AGENTS.md](./AGENTS.md).**

## Quick Start

### 1. Install

```bash
pnpm add @feedback/react
```

### 2. Import styles

In your app entry point (e.g. `app/layout.tsx`, `src/main.tsx`):

```tsx
import "@feedback/react/styles.css";
```

### 3. Wrap your app

```tsx
import { FeedbackProvider, useFeedback } from "@feedback/react";

function FeedbackButton() {
  const { isActive, toggle } = useFeedback();
  return (
    <button
      data-feedback-overlay
      onClick={toggle}
      className="fixed bottom-4 right-4 z-[999990] rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      {isActive ? "Close Feedback" : "Feedback"}
    </button>
  );
}

export function App() {
  return (
    <FeedbackProvider endpoint="/api/v1/feedback" projectId="my-project">
      <YourApp />
      <FeedbackButton />
    </FeedbackProvider>
  );
}
```

That's it. Clicking the button activates feedback mode — users highlight an element, leave a comment, and the SDK handles the rest.

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
<FeedbackProvider
  endpoint="http://localhost:8787/api/v1/feedback"
  projectId="your-project-slug"
/>
```

## API Reference

### `<FeedbackProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | — | **Required.** URL the SDK POSTs feedback to |
| `projectId` | `string` | — | **Required.** Project slug or ID (worker resolves slugs to IDs) |
| `categories` | `FeedbackCategory[]` | `['bug','suggestion','question','other']` | Category picker options |
| `captureMethod` | `'html2canvas' \| 'native'` | `'html2canvas'` | Screenshot capture method |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | UI theme |
| `exclude` | `string[]` | `[]` | CSS selectors excluded from highlighting |
| `children` | `ReactNode` | — | App content |

### `useFeedback()`

Returns `{ isActive: boolean; toggle: () => void; config: FeedbackProviderConfig }`.

### `data-feedback-overlay`

Add this attribute to any element that should **not** be highlighted when feedback mode is active:

```tsx
<button data-feedback-overlay onClick={toggle}>Feedback</button>
```

### Exports

```ts
import { FeedbackProvider, useFeedback } from "@feedback/react";
import { HighlightOverlay, CommentPopover } from "@feedback/react";
import { captureScreenshot, serializeDOM, generateSelector, submitFeedback } from "@feedback/react";
import "@feedback/react/styles.css";
```

## Backend Contract

The SDK POSTs `multipart/form-data` to your `endpoint` with:

| Field | Type | Description |
|---|---|---|
| `metadata` | `string` (JSON) | `FeedbackMetadata` object — see `@feedback/shared` types |
| `screenshot` | `Blob` (PNG) | Screenshot of the selected element |
| `dom-snapshot` | `Blob` (JSON) | Serialized DOM tree of the selected element |

Your server should return `201 { id: string }` on success.

The `@feedback/worker` package provides a full Cloudflare Worker implementation. See [AGENTS.md](./AGENTS.md) for deployment and configuration details.

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

## Screenshot Capture

The SDK uses [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) for screenshot capture, which natively supports modern CSS color functions (`lab()`, `oklch()`, `lch()`, `oklab()`) and `object-fit`.

## Monorepo Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test:run         # Run tests
pnpm typecheck        # Type check
```

### Linking locally

To use `@feedback/react` in another project during development, add a `link:` dependency:

```json
{
  "dependencies": {
    "@feedback/react": "link:./path/to/feedback-lib/packages/react",
    "@feedback/shared": "link:./path/to/feedback-lib/packages/shared"
  }
}
```

## Architecture

```
@feedback/shared     @feedback/react          @feedback/worker          @feedback/dashboard
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐   ┌─────────────────┐
│ types.ts     │◄────│ FeedbackProvider  │     │ Hono CF Worker      │   │ React SPA        │
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