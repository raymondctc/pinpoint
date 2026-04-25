# @pinpoint/shared — Agent Reference

Types, validators, and constants that are shared across `@pinpoint/react`, `@pinpoint/worker`, and `@pinpoint/dashboard`. This package has no runtime dependencies and is compiled with plain `tsc`.

## Commands

```bash
pnpm build       # tsc → dist/
pnpm dev         # tsc --watch
pnpm test:run    # vitest run
pnpm typecheck   # tsc --noEmit
```

## Exports

Everything is re-exported from `src/index.ts`. The three source files:

### `src/types.ts`

- **`FeedbackMetadata`** — shape the SDK POSTs (`comment`, `projectId`, `selector`, `url`, `viewportWidth`, `viewportHeight`, `userAgent`, `captureMethod`, `category`)
- **`FeedbackItem`** — shape returned by the worker API (extends metadata with `id`, `status`, `createdBy`, `createdAt`, `updatedAt`, `deletedAt`)
- **`DOMSnapshotNode`** — recursive DOM tree node (`tag`, `attrs`, `children`, `text`, `styles`)
- **`PinpointProviderConfig`** — props accepted by `<PinpointProvider>` in the React SDK
- **Constants**: `MAX_DOM_DEPTH`, `MAX_SNAPSHOT_SIZE`, `MAX_COMMENT_LENGTH`, `COMPUTED_STYLES_WHITELIST`

### `src/validators.ts`

- **`validateComment(value)`** → `ValidationResult<string>` — enforces max length and non-empty
- **`validateFeedbackMetadata(obj)`** → `ValidationResult<FeedbackMetadata>` — checks required fields and enum values
- **`validateDOMSnapshot(obj)`** → `ValidationResult<DOMSnapshotNode>` — checks structural shape

All validators return `{ valid: true, data }` or `{ valid: false, error: string }`.

## Adding a field

1. Add the field to the relevant type(s) in `src/types.ts`
2. Add validation rules in `src/validators.ts`
3. Rebuild (`pnpm build`) before the dependent packages will pick it up
4. Continue with the [cross-package walkthrough](../../AGENTS.md#adding-a-new-feedback-field) at the root
