# CLAUDE.md — working notes for AI coding sessions

AI Presentation Builder (take-home, 2-day hard deadline). Full rationale: `docs/DECISIONS.md` (D1–D39), rejected options: `docs/TRADEOFFS.md` (do not implement anything from it unless asked).

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
10. After any store change that moves a selected element (gesture commit, undo/redo, AI op, scale change), call `moveableRef.current.updateRect()` in a layout effect keyed on `[slide, scale, targets]`, or the outline and handles stay at the old rect.
11. Never mark drag state with `classList`: React re-renders (e.g. active slide changing while scrolling) rewrite `className`. Keep it in the store (`draggingSlideId`, `dropTarget`).
12. Scrolling mid-drag: Moveable `scrollable` + `scrollContainer` getter (a child's layout effect runs before the parent's ref is attached) + `checkScrollEvent`; replay a `mousemove` at the last pointer after scroll so the element follows a still cursor (D34).

## Current status

- [x] Scaffold, tooling (ESLint layer rules, Prettier, husky + lint-staged, Vitest, CI), `/api/hello`, `/api/sse-test`, Moveable verified on React 19; deployed (Vercel, bom1), SSE streams unbuffered, Stop aborts
- [x] Design system: Tailwind v4 tokens (light/dark), Geist / Geist Mono / Instrument Serif, shadcn button/tooltip/dropdown-menu/kbd in JS, `IconButtonTip`, `ToolbarGroup`, `useColorScheme`, slide theme `paper` (D32)
- [x] `lib/`: schema v2 (Zod), ops (D24, D30), layout slots + collision-aware placement (D31), theme roles + `resolveColor`; 53 tests
- [x] Store (vanilla Zustand, D25 grouping, actions) + canvas/filmstrip port (D33); sample deck loads on start; 63 unit tests, 16 browser checks
- [x] Canvas fixes from testing: drag while scrolling + edge auto-scroll, drop ring, undo/redo reveal (D34); 69 unit tests, 33 browser checks
- [x] Deploy canvas (checkpoint 13:00)
- [x] Agent (D35): `src/lib/agent` (context, flat tools, plan, prompts), `/api/plan`, `/api/populate`, `/api/agent` with provider fallback; client services, chat panel (generate / edit modes, chips, retry, stop, restore); 97 unit + flow tests, browser check with mocked `/api`
- [x] Smoke test round 1 (D36): tool choice forced on step 0 only, Sarvam retry in `auto`, populate requires ops, `/api` served by Vite in `npm run dev`, Gemini `gemini-3.8-flash`, `npm run llm:probe`
- [x] Sarvam non-streamed by default (D37): its streamed tool-call chunks fail the SDK's schema
- [x] Runs must finish their job (`isComplete`: plan arrived / ops landed), plan retried once, 7-char ids (D38)
- [x] `llm:probe` green on Sarvam (15:10)
- [x] Persistence (IndexedDB autosave, restore deck + chat, continue after reload) + StartScreen + "+ New" (D39); 109 tests
- [ ] Deploy with keys and check generate → edit on the deployed URL (checkpoint 17:00)
- [ ] e2e reviewer-script test (Playwright) + golden-prompt eval

## Where things are

- Store: `src/store` (`appStore`, `createAppStore`, `actions.js`); components read it via `src/hooks/useDeck.js` (`useDeck`, `getDeckState`, `useDeckActions`)
- Renderer: `src/features/slide` (props only + `SlideInteractionContext`); canvas: `src/features/canvas`; filmstrip: `src/features/filmstrip`
- Ops: `src/lib/ops` (`applyOp`, `OpError`, `findElement`) · schemas: `src/lib/schema` · placement: `src/lib/layout` (`placeElement`, `reflowLayout`, `findFreeSpot`, `LAYOUT_DEFS`) · slide themes: `src/lib/theme` · factories: `src/lib/factories.js`
- UI kit: `src/primitives/ui/*` (shadcn, JS), `src/primitives/cn.js`, tokens in `src/styles/index.css` (`bg-panel`, `text-muted-foreground`, `bg-user`, `bg-ai`, `text-ui`, `text-label`, `font-display`, `shadow-float`, `ease-standard`)
- Add shadcn components on a dev machine: `npx shadcn@latest add <name>` (components.json is JS mode)

- Agent: `src/lib/agent` (tools, plan, prompts, context) · `api/_lib` (sse, guard, providers, runTurn) · client runs in `src/services/ai.js` (bound via `src/hooks/useAi.js`) · chat UI in `src/features/chat`
- Persistence: `src/services/persistence.js` (load/save/autosave), `src/services/workspace.js` (boot, new, start blank/sample), bound in `src/hooks/useWorkspace.js`; screens switch on `ui.screen`
- Local `/api`: `scripts/vite-local-api.js` (dev-only Vite middleware); live check of the AI path: `npm run llm:probe`
- Tests that span client and server: `tests/flow.test.js` (stubbed fetch → real handlers → mock model)

## Open items (proposed, not yet decided)

Auto-shrink as render-time measurement · print view as a print-only container (no router).
