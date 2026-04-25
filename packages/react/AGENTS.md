# @pinpoint/react — Agent Reference

React SDK providing the highlight overlay, comment form, screenshot capture, and DOM serialization. Built as a Vite library (ES module output). Peer dependencies: React 18+/19+.

## Commands

```bash
pnpm build       # vite build → dist/ (ES module + .d.ts)
pnpm dev         # vite build --watch
pnpm test:run    # vitest run
pnpm typecheck   # tsc --noEmit
```

## Component & Module Map

| File | Purpose |
|---|---|
| `src/PinpointProvider.tsx` | Context provider — owns feedback mode state, element selection, capture orchestration, form submission |
| `src/usePinpoint.ts` | Hook — exposes `{ isActive, toggle }` from PinpointContext |
| `src/HighlightOverlay.tsx` | Full-viewport overlay that intercepts hover/click to select elements |
| `src/CommentPopover.tsx` | Desktop comment form, positioned near the selected element |
| `src/MobileCommentSheet.tsx` | Mobile bottom-sheet comment form (Radix Sheet) |
| `src/FeedbackSubmitter.ts` | Builds and POSTs `multipart/form-data` to the configured endpoint |
| `src/ScreenshotCapture.ts` | Captures the selected element as PNG using `modern-screenshot` |
| `src/DOMSerializer.ts` | Serializes DOM tree to `DOMSnapshotNode` with depth/size truncation |
| `src/selectors.ts` | Generates a stable CSS selector for a given element |
| `src/styles.css` | Component styles — must be imported by the consumer |

## SDK Integration

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
      captureMethod="dom"   // or "native"
      theme="auto"          // "light" | "dark" | "auto"
    >
      <YourApp />
      <PinpointButton />
    </PinpointProvider>
  );
}
```

**Key points:**
- `data-pinpoint-overlay` prevents an element from being highlighted
- `data-pinpoint-popover` restores `pointer-events` under modal `react-remove-scroll` — use both on a floating toggle
- `projectId` accepts a slug or nanoid — the worker resolves slugs automatically
- `captureMethod: "dom"` uses `DOMSerializer` + `modern-screenshot`; `"native"` uses the browser's native screenshot API

## Adding a field to submitted metadata

1. Update `FeedbackMetadata` in `@pinpoint/shared` (see [shared/AGENTS.md](../shared/AGENTS.md))
2. Include the new field in `FeedbackSubmitter.ts` when building the `FormData`
3. Continue with the [cross-package walkthrough](../../AGENTS.md#adding-a-new-feedback-field) at the root
