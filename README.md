# @feedback

A modular feedback collection SDK for React apps. Lets users highlight elements, leave comments, and submit annotated screenshots and DOM snapshots to your server.

## Packages

| Package | Description |
|---|---|
| [`@feedback/shared`](./packages/shared) | Types, constants, and validators — framework-agnostic |
| [`@feedback/react`](./packages/react) | React SDK — `FeedbackProvider`, `HighlightOverlay`, `CommentPopover`, screenshot capture, DOM serialization, and submission |
| `@feedback/mock-worker` | Dev-only Cloudflare Worker that stubs the backend API |

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

## API Reference

### `<FeedbackProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | — | **Required.** URL the SDK POSTs feedback to |
| `projectId` | `string` | — | **Required.** Groups feedback by project |
| `categories` | `FeedbackCategory[]` | `['bug','suggestion','question','other']` | Category picker options |
| `captureMethod` | `'html2canvas' \| 'native'` | `'html2canvas'` | Screenshot capture method |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | UI theme |
| `exclude` | `string[]` | `[]` | CSS selectors excluded from highlighting |
| `children` | `ReactNode` | — | App content |

### `useFeedback()`

Returns `{ isActive: boolean; toggle: () => void; config: FeedbackProviderConfig }`.

### `data-feedback-overlay`

Add this attribute to any element that should **not** be highlighted when feedback mode is active — e.g. your toggle button, toast notifications, or modals.

```tsx
<button data-feedback-overlay onClick={toggle}>Feedback</button>
```

### Exports

```ts
// Components
import { FeedbackProvider, useFeedback } from "@feedback/react";
import { HighlightOverlay } from "@feedback/react";
import { CommentPopover } from "@feedback/react";

// Utilities (if you want to build your own UI)
import { captureScreenshot } from "@feedback/react";
import { serializeDOM } from "@feedback/react";
import { generateSelector } from "@feedback/react";
import { submitFeedback } from "@feedback/react";

// Styles
import "@feedback/react/styles.css";
```

## Backend Contract

The SDK POSTs `multipart/form-data` to your `endpoint` with:

| Field | Type | Description |
|---|---|---|
| `metadata` | `string` (JSON) | `FeedbackMetadata` object — see types |
| `screenshot` | `Blob` (PNG) | Screenshot of the selected element |
| `dom-snapshot` | `Blob` (JSON) | Serialized DOM tree of the selected element |

Your server should return `201 { id: string, status: "created" }` on success.

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

  return NextResponse.json({ id: crypto.randomUUID(), status: "created" }, { status: 201 });
}
```

## Screenshot Capture

The SDK uses [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) for screenshot capture, which natively supports modern CSS color functions (`lab()`, `oklch()`, `lch()`, `oklab()`) and `object-fit`. No workarounds needed.

## Monorepo Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test:run

# Type check
pnpm typecheck

# Watch mode
pnpm dev
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
@feedback/shared          @feedback/react
┌─────────────────┐      ┌──────────────────────────┐
│ types.ts         │◄─────│ FeedbackProvider.tsx       │
│ validators.ts    │      │ HighlightOverlay.tsx       │
│ constants        │      │ CommentPopover.tsx         │
└─────────────────┘      │ ScreenshotCapture.ts       │
                          │ DOMSerializer.ts           │
                          │ FeedbackSubmitter.ts       │
                          │ selectors.ts               │
                          │ useFeedback.ts             │
                          └──────────────────────────┘
```

**Flow:** User clicks toggle → `HighlightOverlay` lets them pick an element → `CommentPopover` collects comment + category → `captureScreenshot` + `serializeDOM` capture evidence → `submitFeedback` POSTs multipart form data to your endpoint.

## License

MIT