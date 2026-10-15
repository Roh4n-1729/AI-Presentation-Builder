# CLAUDE.md — working notes for AI coding sessions

AI Presentation Builder (take-home, 2-day hard deadline). Full rationale: `docs/DECISIONS.md` (D1–D29), rejected options: `docs/TRADEOFFS.md` (do not implement anything from it unless asked).

## Stack

Vite 8 + React 19 (JavaScript + JSDoc, no TS) · Vercel functions in `/api` · AI SDK v7 (`ai@7`) with `sarvam-ai-sdk` (primary `sarvam-105b`), `@ai-sdk/google`, `@ai-sdk/groq` fallbacks · Zod · Zustand (vanilla) + Immer patches · react-moveable · @dnd-kit/sortable · Recharts 3 · Tailwind v4 + shadcn/ui (JS) + lucide-react · pptxgenjs · idb-keyval · Vitest.

## The invariant

Every deck change is an op → `dispatch(op)` → `applyOp(deck, op)` (pure, `src/lib/ops`, shared with `/api`). No other code mutates the deck.

## Rules

- Ops are id-anchored (`afterSlideId`, never indices) and fully resolved (ids, bbox, slot) before dispatch; `applyOp` only clamps. Copies are id-based. (D24)
- AI ops join the top history entry only if it has the same `turnId`. (D25)
- Layers: `screens → features → primitives`; `features → hooks → store → lib`; `hooks → services → store, lib`; `api → lib only`. Nothing in `lib/` knows React. Enforced by ESLint.
- `src/lib` and `api/`: relative imports with explicit `.js`; no `@/` alias; no `import.meta.env`. (D28)
- `SlideRenderer` is the only thing that draws a slide; inline styles from schema + theme, no Tailwind classes inside slides.
- Colors in the schema are theme roles (`text`, `accent`, …) resolved by `resolveColor`; hex only as override.
- Server streams SSE events `status | text | tool | op | error | done`; ops emitted on tool completion only.
- Keys only in env vars. Never send image data to `/api`.
- Conventional Commits. Explain non-obvious code briefly; prefer simple over clever.

## Canvas gotchas (from the spike — keep these fixes)

1. Write to the store only on pointer release; Escape restores inline styles and writes nothing.
2. Click-and-drag an unselected element: stash the pointerdown event, call `dragStart` one frame after Moveable mounts, only if the pointer is still down.
3. Drag-cancel Escape listener: capture phase + `stopImmediatePropagation`.
4. Deselect only on the slide background itself (`e.target === frame || .artboard`).
5. Pressing an already-selected element (no Shift) keeps the group.
6. Text edit = uncontrolled contentEditable; `select()` must not clear `editingId` (blur commits).
7. `user-select: none` on the artboard, opt back in on `[contenteditable=true]`.
8. Cross-slide hit-test via `document.elementsFromPoint` → `[data-slide-drop]` / `[data-slide-frame]`; frame drop converts screen rect to target units.
9. Recharts: explicit width/height = bbox (no ResponsiveContainer), `pointer-events: none`.

## Current status

- [x] Scaffold, tooling (ESLint layer rules, Prettier, husky + lint-staged, Vitest, CI), `/api/hello`, `/api/sse-test`, Moveable verified on React 19
- [ ] Design system (Tailwind v4 tokens, fonts, shadcn JS)
- [ ] `lib/`: schema v2, ops, layout + tests
- [ ] Store + canvas/filmstrip port → deploy (checkpoint 13:00)
- [ ] Sarvam smoke test; `/api/plan`, `/api/populate`, `/api/agent`; chat (checkpoint 17:00)

## Open items (proposed, not yet decided)

Flat tool input schemas (no unions) for provider portability · `plan_deck` returns per-slide intent/key points/visual · `findFreeSpot(slide, size, near)` for collision-aware drops · filmstrip insertion line · auto-shrink as render-time measurement · print view as a print-only container (no router) · client-side request size guard (Vercel body limit 4.5 MB) · per-IP rate limit is best-effort on serverless.
