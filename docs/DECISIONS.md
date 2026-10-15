# Architecture decisions

These decisions were made in an AI-assisted planning session before the build and validated with a throwaway canvas spike (drag, snap, resize, cross-slide move, undo on a sample deck). Alternatives that were considered and **not** built are recorded in [`TRADEOFFS.md`](./TRADEOFFS.md).

Each record: **Decision** · **Why** · **Consequences**. Status of all records: _Accepted_ (2026-10-15) unless marked otherwise.

When a decision changes during the build, the original record stays as written, gets a **Status** line pointing to the record that amends or supersedes it, and the changed part is ~~struck through~~. New records are appended (D24 onwards).

## Revision log

| Date       | Record                                                                | Change                                                                                                                                                                                                                | Affects          |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 2026-10-15 | [D24](#d24-ops-are-id-anchored-and-fully-resolved)                    | Ops address slides and positions by id, carry resolved geometry and ids, and copies are id-based; `reorder_elements` naming; new `update_deck` op; tool → op mapping                                                  | D1, D3, D9, D11  |
| 2026-10-15 | [D25](#d25-ai-history-entries-are-contiguous-runs-of-one-turn)        | One AI turn = one _contiguous_ history entry; a user edit mid-turn splits it                                                                                                                                          | D10              |
| 2026-10-15 | [D26](#d26-vanilla-zustand-store-react-binds-through-hooks)           | Store created with `zustand/vanilla`; React binds through hooks                                                                                                                                                       | D10, D19         |
| 2026-10-15 | [D27](#d27-sarvam-through-its-official-ai-sdk-provider-on-ai-sdk-v7)  | Sarvam through the official `sarvam-ai-sdk` provider on AI SDK v7 instead of the generic OpenAI-compatible provider                                                                                                   | D14, D15         |
| 2026-10-15 | [D28](#d28-api-runs-as-plain-node-esm-layer-rules-enforced-by-eslint) | `/api` as plain Node ESM with explicit `.js` imports; layer rules enforced by ESLint; Vercel function config                                                                                                          | D18, D19         |
| 2026-10-15 | [D29](#d29-react-19)                                                  | React 19 kept after verifying react-moveable on it                                                                                                                                                                    | D18              |
| 2026-10-15 | [D30](#d30-schema-v2-and-op-semantics-as-built)                       | Schema v2 details as built: optional text style filled from the theme, `caption` role, data-shape checks, `OpError` codes, lock and slot rules, deterministic `applyOp`                                               | D4, D9, D11      |
| 2026-10-15 | [D31](#d31-collision-aware-placement)                                 | Placement: explicit bbox wins, then slot, then nearest free spot, shrinking to 75%/50% before overlapping                                                                                                             | D7, D9           |
| 2026-10-15 | [D32](#d32-design-system-implementation)                              | shadcn components ported from upstream source into JS (`components.json` kept for the CLI); `cn` in `primitives/`; token names; validated chart palette                                                               | D16, D17         |
| 2026-10-15 | [D33](#d33-store-and-canvas-as-built)                                 | Store and canvas as built: props-only renderer with an interaction context, HTML chart legend, pie colors in data (Recharts 3), features reach the store only through hooks (lint-enforced), filmstrip insertion slot | D6, D7, D10, D19 |
| 2026-10-15 | [D34](#d34-dragging-across-a-scrolling-column-drop-ring-undo-reveal)  | Drag survives scrolling (store-driven drag state, Moveable `scrollable` + replayed pointer, edge auto-scroll); overlay drop ring with label; undo/redo reveals the change from patch paths                            | D7, D10, D33     |

---

## Core architecture

### D1. One op language, one dispatch

- **Status:** Accepted; op shapes amended by [D24](#d24-ops-are-id-anchored-and-fully-resolved).
- **Decision:** Every deck change is an op (`add_slide`, `move_element`, `update_element`, …) applied through a single `dispatch(op)` → `applyOp(deck, op)`. Canvas gestures, keyboard shortcuts, toolbar actions, the data editors and AI tool calls all produce the same ops.
- **Why:** The brief requires manual and AI edits to share one source of truth without clobbering each other. With one mutation path, there's one place to validate, one history, and identical behavior for user and AI changes.
- **Consequences:** `applyOp` is pure (it mutates an Immer draft), lives in `src/lib/ops`, and is imported by both the browser and the API functions. Ops carry any ids they need (e.g. `newId` for copies) so both sides produce identical results.

### D2. The client store is canonical

- **Decision:** The deck lives in the browser store. API requests send a snapshot; the server applies tool calls to a throwaway working copy only so the model gets real results (new ids, errors), and streams each op back to the client.
- **Why:** "If you have two copies of the deck, you will lose." A server-side source of truth with whole-slide replacement on the client would overwrite manual edits.
- **Consequences:** No backend persistence. The next AI turn always sees the current state, including a chart the user just dragged to another slide. AI ops that target an element the user deleted mid-stream are skipped with a notice.

### D3. Normalized schema with stable ids

- **Status:** Accepted; extended by [D24](#d24-ops-are-id-anchored-and-fully-resolved) (positions in ops are also expressed by id).
- **Decision:** `deck.slideOrder[]` + `deck.slides{}`; `slide.elementOrder[]` (z-order) + `slide.elements{}`. Short prefixed ids (`s_k3f9`, `el_c7x2`).
- **Why:** Reordering slides or z-order is an array move; cross-slide moves don't need deep copies; lookups are O(1). Stable ids survive manual edits (index paths don't). Short ids cost fewer tokens and are less likely to be hallucinated.
- **Consequences:** Ids are regenerated on duplicate, paste and import.

### D4. Element model

- **Status:** Accepted; details as built in [D30](#d30-schema-v2-and-op-semantics-as-built).
- **Decision:** Every element has `id`, `type` (text, image, chart, table, shape), `bbox {x, y, w, h, rotation?}`, optional `locked` and `slot`, and a type-specific payload. Chart type is stored separately from chart data. Text is an array of paragraphs (text, bullet, level) with box-level style.
- **Why:** Bounding boxes on every element make drag, resize and cross-slide moves uniform. Separating chart type from data means switching bar → line keeps the data by construction. Paragraphs are simple for the model to write and map directly to PPTX text runs.
- **Consequences:** No mixed formatting inside a paragraph (documented limit). Pie charts use the first series.

### D5. Fixed 1920×1080 artboard

- **Decision:** All coordinates are in a 1920×1080 logical space, rendered with CSS `transform: scale()`.
- **Why:** LLMs reason better in pixel-like units than percentages. 1920 / 144 = 13.333 in, exactly the width of a 16:9 PowerPoint slide, so export is a straight unit conversion.
- **Consequences:** Selection handles render in screen space outside the scaled element, so they stay a constant size at any zoom.

---

## Canvas & interaction

### D6. DOM-based renderer, one `SlideRenderer`

- **Decision:** Slides are absolutely positioned DOM elements (text as `contentEditable`, charts as live Recharts, tables as `<table>`). A single `SlideRenderer({ slide, theme, mode })` draws slides for the canvas, thumbnails, present mode and the print view.
- **Why:** The content types are native to the DOM. One renderer guarantees that thumbnails, presentation and export match the canvas.
- **Consequences:** Interactive layers (Moveable, toolbars, highlights) sit next to the renderer, never inside it. The renderer uses inline styles from the schema and theme only, with no utility classes.

### D7. Drag, resize and snap: react-moveable; reorder: dnd-kit

- **Decision:** react-moveable handles drag, resize, alignment guides and group moves. dnd-kit sortable handles filmstrip reorder. Cross-slide drops use our own hit-testing (`elementsFromPoint` → a filmstrip thumbnail or another slide frame).
- **Why:** Snapping and guides are required and fiddly to build; Moveable was verified on a scaled artboard in the spike.
- **Consequences:**
  - During a gesture, Moveable changes only the DOM node's inline transform. The store is written **once on release**, giving one op and one undo entry per gesture.
  - Escape restores the inline styles and writes nothing, so cancel is trivially correct.
  - Dropping on another slide frame converts the screen position into that slide's units; dropping on a thumbnail places the element in a free spot. Both clamp to the artboard.
  - Holding Alt/Option on release copies instead of moving.

### D8. Continuous slide column

- **Decision:** The editor shows all slides stacked in a vertical scroll (Gamma-style), with a filmstrip on the left. The most visible slide is the "active" slide.
- **Why:** The adjacent slide is always visible, so dragging onto it is a natural cross-slide move, in addition to filmstrip drops.
- **Consequences:** All slides stay mounted (see the performance entries in `TRADEOFFS.md`).

### D9. Layout slots and clamping

- **Status:** Accepted; _where_ the layout code runs is amended by [D24](#d24-ops-are-id-anchored-and-fully-resolved) (callers resolve slots and free spots; `applyOp` only clamps); placement order in [D31](#d31-collision-aware-placement).
- **Decision:** Each layout (title, content, two-column, comparison, section, chart-focus, blank) defines named slots with geometry and a text budget. Elements added without a `bbox` go into the matching slot; if it's full, a free-spot search places them; every box is clamped to the artboard.
- **Why:** LLMs place boxes poorly. Slots make generated decks look designed and make the model's job easier.
- **Consequences:** An element records its `slot`; a manual drag clears it. `change_layout` reflows only elements still in a slot, so it never moves something the user placed by hand. Text that overflows its box shrinks its font down to a floor.

---

## State & history

### D10. Zustand + Immer patches

- **Status:** Accepted; AI-turn grouping amended by [D25](#d25-ai-history-entries-are-contiguous-runs-of-one-turn); store construction amended by [D26](#d26-vanilla-zustand-store-react-binds-through-hooks).
- **Decision:** One Zustand store with slices (deck, history, ui, chat, generation, persistence). `dispatch` uses Immer `produceWithPatches`; history stores `{ label, patches, inversePatches, source, turnId }`.
- **Why:** Inverse patches give undo/redo for free, are small, and work the same for user and AI ops. Immer keeps untouched slides as the same objects, so memoized components skip re-rendering.
- **Consequences:**
  - ~~One AI turn is grouped into one history entry, so one ⌘Z reverts it.~~ One AI turn is grouped into one history entry _while no user edit interrupts it_ (D25), so one ⌘Z reverts it.
  - Undo is disabled while an AI turn is streaming.
  - "Undo this" on an AI message works only while that turn is the latest entry (selective undo over newer edits would corrupt state).

---

## AI

### D11. Granular tools, no regenerate path

- **Status:** Accepted; tool → op mapping and naming fixed in [D24](#d24-ops-are-id-anchored-and-fully-resolved). Tool list as built (one add tool per element type, flat inputs) in [D35](#d35-the-agent-as-built).
- **Decision:** Tools at slide, element and chart granularity (`add_slide`, `update_slide`, `delete_slide`, `duplicate_slide`, `reorder_slides`, `change_layout`, `add_element`, `update_element`, `update_elements` (batch), `delete_element`, `move_element`, `resize_element`, `reorder_elements`, `add_chart`, `update_chart_data`, `change_chart_type`), plus `get_slide` for detail and `finish_turn({ summary, suggestions })` to end every turn.
- **Why:** Edits must be targeted patches. With no tool that rewrites the deck, the model cannot regenerate it. The batch tool keeps deck-wide edits ("make it more formal") to one call on rate-limited free tiers. `finish_turn` returns the chat summary and suggestions as structured data on any model.
- **Consequences:**
  - Tool arguments are validated with Zod; errors are returned to the model as results so it can correct itself.
  - Tools respect `locked`.
  - Each AI reply lists the ops it applied as clickable chips, so targeted patching is visible to the user.

### D12. Two-phase generation, orchestrated by the client

- **Status:** Accepted; concurrency (2) and retry granularity ("Retry empty slides") set in [D35](#d35-the-agent-as-built).
- **Decision:** `/api/plan` forces a `plan_deck` call and creates titled skeleton slides immediately. The client then calls `/api/populate` per slide, 2–3 in parallel. Later edits go through `/api/agent`.
- **Why:** Required by the brief, and practical: visible progress, short requests that avoid serverless timeouts, per-slide retry, and output-token limits respected.
- **Consequences:** Stop keeps whatever has landed; a failed slide shows "Retry this slide".

### D13. Compact, fresh context every turn

- **Decision:** Each request includes a compact deck description built from the store: slide order, ids, element types, boxes, truncated text, chart categories and series, the current slide and the selection. Image data is never sent. Chat history is the last few turns plus a running summary.
- **Why:** Keeps tokens and latency low, and lets "this chart" or "slide 3" resolve correctly. Because it's rebuilt from the store every turn, manual changes are always visible to the model.
- **Consequences:** `get_slide` provides full content when the model needs it.

### D14. Sarvam as the primary model, with fallbacks

- **Status:** Accepted; provider integration amended by [D27](#d27-sarvam-through-its-official-ai-sdk-provider-on-ai-sdk-v7).
- **Decision:** `sarvam-105b` on Sarvam's V1 chat completions endpoint (tool calling, streaming) is the primary model. Fallback chain: Gemini Flash, then Groq `gpt-oss-120b`, selected server-side and triggered on rate limits, overload or exhausted credits.
- **Why:** Sarvam's platform is provided for this assignment and supports what the agent needs. Fallbacks keep the deployed app working if a free quota runs out.
- **Consequences:** Reasoning is disabled or kept low and `max_tokens` is set explicitly (reasoning tokens count against it). A short test of tool-call reliability, latency and credit cost happens before relying on Sarvam; results go in the README. Keys live only in environment variables.

### D15. Streaming: AI SDK Core with our own event protocol

- **Status:** Accepted; AI SDK major version pinned by [D27](#d27-sarvam-through-its-official-ai-sdk-provider-on-ai-sdk-v7).
- **Decision:** The server uses AI SDK Core (`streamText`, tools, multi-step, abort). Responses are Server-Sent Events over a `fetch` POST with our own events: `status`, `text`, `tool`, `op`, `error`, `done`. The client reads them with plain `fetch` + `TextDecoderStream` + `eventsource-parser`.
- **Why:** We keep transport and state under our control (no second copy of chat state), use one protocol for all three endpoints, and can swap the server loop without touching the client.
- **Consequences:**
  - Ops are emitted when a tool completes and validates; assistant text streams token by token.
  - The client flushes queued events once per animation frame.
  - No automatic reconnect or retry: re-sending a request re-runs the AI turn. Our code decides between backoff, provider fallback and a Retry button.
  - Stop aborts the request, and the abort reaches the model call.

---

## UI & design

### D16. Tailwind v4 + shadcn/ui + Lucide

- **Status:** Accepted; how the components got into the repo, token names and `cn` location in [D32](#d32-design-system-implementation).
- **Decision:** Tailwind v4 with design tokens as CSS variables (`@theme`), shadcn/ui components (Radix underneath) generated into the repo in JavaScript, Lucide outlined icons.
- **Why:** Fits the chosen light, minimal design; tokens make dark mode a variable swap; Radix provides accessible menus, dialogs and the drawer. One styling system only.
- **Consequences:** The slide renderer does not use Tailwind classes (see D6), so canvas, print and PPTX read the same values.

### D17. Design language

- **Decision:** Light-first with dark mode; Instrument Serif for display, Geist for UI, Geist Mono for data; Lucide at 1.5px stroke. **Indigo marks the user** (selection, focus, active tool); **saffron marks the AI** (progress, the glow on elements it changed, op chips). Motion is short (120–240ms), uses one easing curve, never runs during a user drag, and respects `prefers-reduced-motion`.
- **Why:** A calm editor where the slides are the most colorful thing on screen, and where it's obvious at a glance what the AI changed. Inspired by sarvam.ai's visual language without using its brand assets.
- **Consequences:** Element colors in the schema are theme roles (`text`, `muted`, `accent`, …) with optional hex overrides, so themes restyle a deck without touching content or positions.

---

## Platform, output & quality

### D18. Vite + React (JavaScript) on Vercel

- **Status:** Accepted; runtime details in [D28](#d28-api-runs-as-plain-node-esm-layer-rules-enforced-by-eslint), React version in [D29](#d29-react-19).
- **Decision:** Vite + React in JavaScript with JSDoc types; API routes as Vercel serverless functions in `/api`; one Vercel project for app and API.
- **Why:** A stack I can fully own and explain in two days. Runtime safety where it matters comes from Zod. The API key stays server-side.
- **Consequences:** `maxDuration` is set for the streaming functions; streaming without buffering is verified on day one.

### D19. Code organization and import rules

- **Status:** Accepted; enforcement added in [D28](#d28-api-runs-as-plain-node-esm-layer-rules-enforced-by-eslint), store binding clarified in [D26](#d26-vanilla-zustand-store-react-binds-through-hooks).
- **Decision:** `primitives/` (dumb UI), `features/` (domain components), `hooks/` (React glue), `services/` (plain JS: agent client, generation, export, persistence), `store/` (slices), `lib/` (pure, shared with `/api`), `screens/`.
- **Why:** Clear boundaries make the code explainable: nothing in `lib/` knows React exists, features reach services only through hooks, and the API imports only from `lib/`.
- **Consequences:** User and AI flows visibly converge at `dispatch`.

### D20. Persistence in IndexedDB

- **Decision:** The deck and chat are autosaved together (debounced) to IndexedDB via `idb-keyval`.
- **Why:** A refresh shouldn't lose work, and localStorage's size limit breaks with uploaded images.
- **Consequences:** Returning users open straight into their last deck. JSON export/import provides backup and portability.

### D21. Export: native PPTX plus a print view

- **Decision:** PowerPoint export through pptxgenjs with native, editable charts and tables; PDF through a print-view route that uses the same `SlideRenderer`.
- **Why:** Charts and tables stay real objects in PowerPoint, and the PDF matches the canvas exactly.
- **Consequences:** Images are converted to base64 before export, so AI images come from CORS-safe sources and uploads are resized client-side.

### D22. Testing and evaluation

- **Decision:** Vitest unit tests for `lib/` (ops, layout, serialization); a Playwright end-to-end test that runs the brief's seven-step review script against the deployed app; a golden-prompt eval that asserts which tools the agent calls for representative requests; a dev-only trace panel for tool calls, latency and cost.
- **Why:** Prompt and code changes can quietly break behavior; these catch regressions in what the product is judged on.
- **Consequences:** Prompts are versioned files so eval runs can be compared.

### D23. Reliability safety nets

- **Decision:** Retry with backoff and a visible countdown, the provider fallback chain, a basic per-IP rate limit and body-size limit on `/api`, and a "Load sample deck" option so the editor, drag-and-drop and export can be tried even if every model provider is unavailable.
- **Why:** A dead free-tier quota during a demo would make the product look broken.
- **Consequences:** The README starts with a quick path through the main features.

---

## Revisions (2026-10-15, build day 1)

### D24. Ops are id-anchored and fully resolved

- **Status:** Accepted (2026-10-15). Amends D1, D3, D9, D11.
- **Decision:**
  1. **Positions are expressed by id, not index.** `add_slide { slide, afterSlideId }` and `reorder_slides { slideId, afterSlideId }`, where `afterSlideId: null` means "first" and an unknown anchor appends at the end. The filmstrip converts its drop index into an anchor before dispatching.
  2. **Ops are fully resolved before dispatch.** Every op that is dispatched or streamed carries concrete ids, `bbox` and `slot`. Slot placement, `findFreeSpot` and `change_layout` reflow run in the caller (the AI tool layer on the server, or the UI hook on the client); `applyOp` only clamps to the artboard. `change_layout` carries the new boxes it computed for slotted elements.
  3. **Copies are id-based.** `duplicate_slide { slideId, newSlideId, idMap, afterSlideId }` and `move_element { …, newId }` copy from the deck they are applied to; no op carries slide or element content copied from the server's working copy.
  4. **Naming and coverage.** The z-order op is `reorder_elements { elementId, direction }` (same name as the tool and the brief). A new `update_deck { patch }` op covers deck title and theme. Array changes use `splice`, not reassignment, so Immer patches stay narrow.
- **Why:** The user can edit while an AI turn streams, so the server's working copy and the client store diverge. An index, a layout computed on the server's copy, or content copied from it would land differently (or wrongly) on the client. Image `src` is stripped from requests (`img:el_x` references), so server-side content copies would also lose pixels.
- **Consequences:** The same op gives the same result on both sides whenever its targets exist on both. Tools and ops are different layers; the mapping is:

  | Tool (model-facing)                                        | Op(s) dispatched                            |
  | ---------------------------------------------------------- | ------------------------------------------- |
  | `plan_deck`                                                | `update_deck` + `add_slide` × N (one batch) |
  | `add_slide`                                                | `add_slide`                                 |
  | `update_slide`                                             | `update_slide`                              |
  | `delete_slide`                                             | `delete_slide`                              |
  | `duplicate_slide`                                          | `duplicate_slide`                           |
  | `reorder_slides`                                           | `reorder_slides`                            |
  | `change_layout`                                            | `change_layout` (with resolved boxes)       |
  | `add_element`, `add_chart`                                 | `add_element` (bbox + slot resolved)        |
  | `update_element`, `update_chart_data`, `change_chart_type` | `update_element`                            |
  | `update_elements`                                          | batch of `update_element`                   |
  | `resize_element`                                           | `update_element { bbox }`                   |
  | `move_element`                                             | `move_element`                              |
  | `delete_element`                                           | `delete_element`                            |
  | `reorder_elements`                                         | `reorder_elements`                          |
  | `get_slide`, `finish_turn`                                 | none (read / control)                       |

### D25. AI history entries are contiguous runs of one turn

- **Status:** Accepted (2026-10-15). Amends D10.
- **Decision:** An AI op joins the top history entry only if that entry has the same `turnId`. Any user edit pushes its own entry, which closes the AI run; later ops of the same turn open a new entry with the same `turnId`. "Undo this" on an AI message is enabled only when the whole turn is a single entry on top of the history.
- **Why:** If AI ops kept appending to an entry buried under newer user edits, undoing it would apply old inverse patches over those edits and clobber them. Undo is only ever safe for the top entry.
- **Consequences:** Usually a turn is still one ⌘Z. If the user edits mid-turn, the turn takes two or more ⌘Z, and "Undo this" shows "Newer edits exist, use ⌘Z".

### D26. Vanilla Zustand store; React binds through hooks

- **Status:** Accepted (2026-10-15). Amends D10, D19.
- **Decision:** The store is created with `createStore` from `zustand/vanilla` in `store/`. React reads it through selector hooks in `hooks/` (e.g. `useDeck(selector)` wrapping `useStore`). Writes go through `dispatch` or action hooks.
- **Why:** D19 says services never import React, but services read and write the store; zustand's `create` binds the store to React. A vanilla store keeps `services/` React-free and testable in Node.
- **Consequences:** Features use the selector hooks (allowed: features → hooks → store). Services call `store.getState()` directly.

### D27. Sarvam through its official AI SDK provider on AI SDK v7

- **Status:** Accepted (2026-10-15). Amends D14, D15.
- **Decision:** Use `sarvam-ai-sdk` (Sarvam's provider for the Vercel AI SDK) with `sarvam('sarvam-105b', { reasoning_effort })` instead of the generic OpenAI-compatible provider. The AI SDK is v7 (`ai@7`); `@ai-sdk/google` and `@ai-sdk/groq` are pinned to the majors that pair with it. Gemini and Groq remain the fallbacks.
- **Why:** The official provider handles Sarvam's auth and request quirks and exposes `reasoning_effort` as a model setting; the provider requires `ai@^7`, so all providers move together.
- **Consequences:** Server code follows the v7 API (`inputSchema` for tools, current multi-step stop conditions), checked against current docs rather than older examples. Sarvam's own agent example wraps the model in `simulateStreamingMiddleware()`, so streaming with tools is part of the Sarvam smoke test. Ops are emitted on tool completion either way, so slides still appear live if a step doesn't stream token by token.

### D28. `/api` runs as plain Node ESM; layer rules enforced by ESLint

- **Status:** Accepted (2026-10-15). Amends D18, D19. `maxDuration` raised to 120 s in [D35](#d35-the-agent-as-built). Local `/api` now runs inside the Vite dev server ([D36](#d36-tool-choice-per-step-local-api-in-vite-gemini-model)).
- **Decision:**
  - `"type": "module"`; every relative import in `src/lib` and `api/` names its file (`./layout.js`). The `@/` alias is for UI code only.
  - ESLint `no-restricted-imports` enforces the layer rules: `src/lib` imports no React/UI libraries and nothing from upper layers; `api/` imports only `src/lib` (plus npm packages).
  - Functions use Web-standard handlers (`export function POST(request)` returning a `Response`). `vercel.json` sets `maxDuration: 60` and `supportsCancellation: true` for `api/*.js` (so Stop reaches the handler as `request.signal`), and the function region `bom1` (Mumbai), close to Sarvam's API.
  - Local development of `/api` runs through `vercel dev`; `vite` alone serves only the UI.
- **Why:** Vercel runs functions as Node modules, where Vite aliases don't exist and extensionless imports fail to resolve. Cancellation is opt-in on Vercel. Rules that a linter checks don't depend on remembering them.
- **Consequences:** A violation fails `npm run lint` locally, in the pre-commit hook and in CI.

### D29. React 19

- **Status:** Accepted (2026-10-15). Amends D18.
- **Decision:** Use React 19 (current major) rather than the spike's React 18.3.
- **Why:** react-moveable 0.56 was only proven on React 18. A headless-browser check on React 19 passed: drag through a 0.4 CSS scale (100 screen px → 250 artboard units), 8-handle resize, and snapping to another element's edge.
- **Consequences:** If a later Moveable or dnd-kit issue turns out to be React-19-specific, pin `react`/`react-dom` to 18.3 (no other code changes expected).

### D30. Schema v2 and op semantics as built

- **Status:** Accepted (2026-10-15). Details D4, D9 and D11; no reversal.
- **Decision:**
  - **Text:** roles are `title | subtitle | body | caption`. `style` (`fontSize`, `color`, `fontWeight`, `align`, `font`) is entirely optional; the renderer fills gaps from the slide theme by role, so the model only writes content.
  - **Data shape is validated, not repaired:** every chart series has one value per category; tables are rectangular (≤ 20 × 10); charts have 1–8 series and ≤ 24 categories. Zod messages are written so the model can fix its own call.
  - **Failures are typed:** `applyOp` throws `OpError` with `NOT_FOUND`, `LOCKED`, `INVALID` or `CONFLICT`. AI tools return it as a tool result; the client skips the op and shows a notice.
  - **Locks:** a locked element refuses `update_element` (except the patch that unlocks it), `move_element` and `delete_element`; z-order changes and copies are allowed; `change_layout` skips it.
  - **Slots:** `move_element` and an `update_element` that changes `bbox` clear `slot` (the element is now hand-placed); `change_layout` ignores placements for elements no longer in a slot.
  - **Merging:** `update_element` merges plain-object fields one level deep (`bbox`, `style`, `chart`); arrays are replaced; `null` removes a field; `id` and `type` can't change. The merged element is re-validated and its box clamped.
  - **Determinism:** `applyOp` uses no clock and mints no ids. `duplicate_slide` uses the op's `idMap` and derives any missing id as `<oldId>_<newSlideSuffix>`; `updatedAt` is set by the store, outside `applyOp`.
- **Why:** The model writes less and fails loudly in a way it can recover from; the same op gives the same deck on the server's working copy and in the browser.
- **Consequences:** 53 unit tests cover schema, ops (including the "two diverged copies" case from D24), layout and themes.

### D31. Collision-aware placement

- **Status:** Accepted (2026-10-15). Details D7 and D9 (was an open item).
- **Decision:** `placeElement` decides where a new element goes, in this order: an explicit bbox (clamped) → the preferred slot → the first free slot accepting the element's kind → the free spot nearest the requested position at the default size, then at 75% and 50% → overlap at the requested spot only if the slide is genuinely full. `findFreeSpot(slide, size, near, ignoreId)` searches a 40-unit grid ordered by distance from `near`, keeping the element's size (used for thumbnail drops and paste).
- **Why:** The brief asks for collision-aware drops; an AI-added second chart shouldn't land on top of the first.
- **Consequences:** Placement code runs in callers (tool layer, UI hooks), never inside `applyOp` (D24).

### D32. Design system implementation

- **Status:** Accepted (2026-10-15). Details D16 and D17.
- **Decision:**
  - **shadcn components** (`button`, `tooltip`, `dropdown-menu`, `kbd`) were taken from the upstream new-york-v4 registry source and converted TSX → JSX by stripping types (what the CLI's JS mode does), because the registry was unreachable from the build sandbox. `components.json` (`tsx: false`, aliases into `src/primitives`) is committed so `npx shadcn add <name>` works on a developer machine. `button` is restyled for §8c (pill primary/secondary/outline/ai, 6px ghost icon buttons).
  - **`cn()`** lives in `src/primitives/cn.js` (UI-only), not `src/lib` (shared with `/api`). It registers the custom font-size tokens with tailwind-merge so `text-ui` isn't mistaken for a color.
  - **Token names:** shadcn's semantic names (`background`, `foreground`, `muted-foreground`, `border`, `primary`, `ring`, …) plus `panel`, `subtle`, `canvas`, `faint`, `user` (indigo), `ai` (saffron), `success`, `warning`. Dark mode is a `.dark` class on `<html>`, set before first paint by an inline script and persisted in localStorage.
  - **Chart palette** (slide theme `paper`): indigo, saffron, teal, violet, ochre, rose, assigned in fixed order. It passes the dataviz palette checks on white (lightness band, chroma floor, worst adjacent CVD ΔE 13.2, normal-vision ΔE 21.5, ≥ 3:1 contrast). It replaces the spike's palette.
- **Why:** Same components and behaviour as the CLI output, with one place to change chrome colors and a chart palette that stays readable for color-blind viewers and in print.
- **Consequences:** Fonts load from Google Fonts (Geist, Geist Mono, Instrument Serif). New shadcn components are added with the CLI on a dev machine, or ported the same way.

### D33. Store and canvas as built

- **Status:** Accepted (2026-10-15). Details D6, D7, D10 and D19.
- **Decision:**
  - **Store** (`src/store`): one vanilla Zustand store (D26) with a deck slice (`deck`, `dispatch`, `undo`, `redo`, `past`/`future`, `revision`, `lastError`, `replaceDeck`) and a UI slice (`selection`, `activeSlideId`, `editingId`, `dropTargetSlideId`). `dispatch` is all-or-nothing per batch and returns `{ ok, error }`; every deck change re-checks the selection and editing target. Composite user actions (`duplicateSelection`, `moveSlideToIndex`, `duplicateSlide`, …) live in `src/store/actions.js` and always dispatch fully resolved ops (fresh ids, concrete boxes).
  - **Renderer** (`src/features/slide`): `SlideRenderer` and the element views take props only. The canvas passes editing callbacks (select, start editing, commit text or a cell) through `SlideInteractionContext`; thumbnails, present mode and print simply don't provide it, so the same renderer is read-only there. Text styles come from `textStyleFor` in `lib/theme`, which the PPTX export will reuse.
  - **Charts:** Recharts 3 with explicit sizes and no animation. The legend is plain HTML in the chart's header row (title left, legend right, series order), because Recharts' bottom legend overlapped the axis inside a scaled artboard. Pie slice colors go in the data (`fill` per entry) since Recharts 3 deprecates `<Cell>`.
  - **Canvas** (`src/features/canvas`): the spike's Moveable logic, with all ten gotchas. A drop on a thumbnail places the element at the free spot nearest its old position (`findFreeSpot`); a drop on the adjacent slide keeps the exact point; both are clamped by `applyOp`.
  - **Filmstrip:** dnd-kit sortable with a `DragOverlay`: the lifted slide follows the pointer and a dashed slot marks the insertion index. Keyboard reorder works through dnd-kit's keyboard sensor. The drop index becomes an anchor op (`moveSlideToIndex`, D24).
  - **Layer rules:** ESLint now also stops `features/` importing `store/` or `services/` (they go through `src/hooks`) and keeps `primitives/` free of app imports.
- **Why:** Keeps "everything converges at dispatch" literally true, and keeps the renderer reusable for thumbnails, present mode and print.
- **Consequences:** 16 browser checks of the reviewers' canvas steps pass (drag, resize, Escape cancel, drop on thumbnail, drop on the adjacent slide, Alt-copy, undo, filmstrip reorder, text edit, multi-select group drag, duplicate, delete).

### D34. Dragging across a scrolling column; drop ring; undo reveal

- **Status:** Accepted (2026-10-15). Details D7, D10 and D33 (fixes found in manual testing).
- **Decision:**
  - **Drag state lives in the store** (`draggingSlideId`, `dropTarget { slideId, copy }`), not in `classList`. The source frame renders `dragging` (z-index above its siblings, artboard overflow visible) from React state, so a re-render mid-drag (the active slide changes as the column scrolls) can't strip it.
  - **Scrolling during a drag:** Moveable's `scrollable` with the slide column as `scrollContainer` (passed as a getter, resolved at drag time) and `scrollOptions.checkScrollEvent`, so Moveable shifts the gesture origin by the scroll offset. Moveable only re-runs the drag on the next mouse move, so while a gesture is active we replay a `mousemove` at the last pointer position: on the next frame after a wheel/scroll event, and in a microtask right after our own edge auto-scroll. The element stays under the cursor and the drop target stays current.
  - **Edge auto-scroll:** `scrollThreshold` 60 px; the column scrolls 18 px per tick while the pointer is within 60 px of its top or bottom edge, and not while the pointer is over the filmstrip or chat.
  - **Drop indicator:** a `DropRing` overlay drawn above the slide (frame or thumbnail): a 3 px ring outside the edge that follows the corner radius, an 8% tint, and a "Move to slide N" / "Copy to slide N" label. The cursor badge shows only the modifier hint ("Hold Alt to copy" / "Copying") and "Esc to cancel".
  - **Undo/redo reveal:** after undo or redo, `revealTarget` reads the history entry's patch paths (`slides.<id>.elements.<id>…`, `elementOrder`, `slideOrder`) against the resulting deck, selects the affected elements (on one slide), scrolls that slide into view (minimal scroll) and flashes the elements in the user's indigo; if no element survives (an undone add), it flashes the slide.
- **Why:** Scrolling while dragging is normal in a continuous column; the drop target has to be unmistakable; undo should never leave the user guessing what changed.
- **Consequences:** Browser checks cover wheel-scroll mid-drag (element stays under the cursor, source frame on top), edge auto-scroll with a drop on the ringed slide, ring labels for move and copy, and undo/redo reveal (scroll, selection, flash).

### D35. The agent as built

- **Status:** Accepted (2026-10-15). Details D11–D15, D23 and D25; amends D11 (tool list), D12 (concurrency, retry) and D28 (`maxDuration`).
- **Decision:**
  - **Code layout.** Everything the model can do lives in `src/lib/agent` (pure, shared): `context.js` (compact deck description, D13), `tools.js` (`createDeckTools`), `plan.js` (`plan_deck` → skeleton ops + per-slide briefs), `prompts.js` (versioned prompts), `request.js` (`toRequestDeck`). The Vercel functions in `api/` are thin: validate the body, build the tools over a working copy of the deck, run the turn, stream events. Shared server helpers are in `api/_lib` (`sse`, `guard`, `providers`, `runTurn`; the underscore keeps Vercel from routing them).
  - **Tools resolve, then apply locally.** Each tool turns flat model input into fully resolved ops (ids, placement via `placeElement`, D24), applies them to the server's working copy with the same `applyOp` and only then emits them. A failed op returns `{ ok: false, error: 'CODE: message' }` to the model, which can correct itself; nothing is emitted. Later tool calls in the same turn see earlier results (new ids, positions).
  - **Tool list.** One add tool per element type (`add_text`, `add_chart`, `add_table`, `add_image`, `add_shape`) instead of a generic `add_element`, plus the D11 slide/element/chart tools, `get_slide` and `finish_turn` (`suggestions` optional, so a model that omits it still ends cleanly). Populate gets a reduced toolset (adds, `update_slide` for notes, `finish_turn`).
  - **Flat tool schemas.** No unions, `nullable` or records in tool inputs (checked by a test through `z.toJSONSchema`), because providers reject or mangle them differently. "Insert first" is the string `"START"` for `afterSlideId`; omitted = last.
  - **Provider chain.** `LLM_PROVIDER` + `LLM_FALLBACKS` (default sarvam → gemini → groq), skipping providers without a key. A turn falls back to the next provider only before any op has been emitted; once ops have reached the client, an error ends the turn (falling back then would replay changes). If Sarvam's stream has an unexpected shape, the same request is retried once with `simulateStreamingMiddleware` (non-streaming call, replayed as a stream); `SARVAM_STREAM=false` forces that mode. Errors map to `RATE_LIMITED` (with `retryAfter`), `AUTH`, `PROVIDER_DOWN`, `BAD_REQUEST`.
  - **Guards.** Body over 4 MB → 413 (the client strips image data first with `toRequestDeck`: image `src` becomes `img:<id>`); per-IP limit (default 30/min, best effort on serverless) → 429 with `Retry-After`; invalid body → 400. SSE heartbeat every 15 s. `maxDuration` is 120 s (a populate or agent turn on a slow free tier can pass 60 s).
  - **Client.** `services/ai.js` runs one AI request at a time: `runEdit` (`/api/agent`), `generateDeck` (`/api/plan`, then `/api/populate` per slide, 2 in parallel), `continueGeneration`, `restorePreviousDeck`. Streamed ops are queued and dispatched once per animation frame, one dispatch per tool (source `ai`, the turn's id, D25), so an op whose target the user deleted meanwhile is skipped alone and counted. Each tool's ops become a chip ("Added chart · slide 3") that selects, scrolls to and flashes its target. Elements an AI op changed glow saffron.
  - **Generation replaces the deck.** A new deck replaces the current one (history cleared, like loading a file); the replaced deck is kept in memory for "Restore previous deck" on that message. "Undo this" is offered on edit turns while the turn is the newest history entry, not on generations.
  - **Failure handling.** A failed or rate-limited request shows its error on the message with Retry (counting down `retryAfter`). For generation, failed and never-started slides are collected and "Retry empty slides" fills just those; Stop keeps what landed and offers "Continue building". A slide that was mid-fill at Stop is not refilled (that could duplicate its elements).
  - **Chat UI.** One composer with two modes (Edit deck / New deck, forced to New deck when the deck is empty), a slide-count picker for new decks, a chip naming the current selection ("chart on slide 2"), Enter to send, Stop while busy. Undo/redo are disabled while a run streams (D10).
- **Why:** The server and client run the same op code, so what the model was told happened is exactly what the client applies. Falling back only before the first op keeps fallback invisible to the deck. Two parallel populate calls stay under free-tier rate limits while slides still appear steadily.
- **Consequences:** `tests/flow.test.js` runs the browser services against the real handlers with a scripted mock model (generate, edit + undo, rate-limit error, failed slide + retry). A browser check with mocked `/api` covers generate → chips → edit with a selection → chip click → Undo this → Restore previous deck. Real-model behaviour (Sarvam tool-call reliability, latency) is measured with `npm run llm:smoke` and recorded in the README.

### D36. Tool choice per step; local `/api` in Vite; Gemini model

- **Status:** Accepted (2026-10-15). Amends D28 (local development) and D35 (provider handling). Prompted by the first live smoke test. Sarvam streaming default changed in [D37](#d37-sarvam-runs-non-streamed-by-default).
- **Context:** Smoke test results: Sarvam handled a forced `plan_deck` call (5.8 s, valid plan) but failed the streamed tool loop with `AI_ToolChoiceViolationError`: with `toolChoice: 'required'` on every step, a step came back as prose. `gemini-2.5-flash` returns 404 for new API keys ("use gemini-3.8-flash"). `vercel` was not on the PATH on the dev machine.
- **Decision:**
  - **Tool choice per step.** Multi-step turns force a tool call on the first step only (`prepareStep`: step 0 `required`, later steps `auto`). A model that closes the turn with a sentence instead of `finish_turn` now ends cleanly; before, the SDK threw after ops had already landed, which reported a failure for a slide that had content. `plan_deck` stays forced.
  - **Sarvam retry.** If Sarvam answers in prose on the forced first step (or a populate turn ends with no ops), it is retried once with tool choice `auto`; a malformed stream still retries once non-streamed. Then the normal fallback applies, still only while no op has been emitted.
  - **Populate must change the slide.** `/api/populate` treats a turn with zero ops as a failure (`NO_CHANGES`), so the retry, the next provider, or the client's "Retry empty slides" handles it instead of leaving an empty slide marked done.
  - **Local `/api` in Vite.** `npm run dev` serves `api/*.js` through a dev-only Vite middleware (`scripts/vite-local-api.js`): Web `Request` in, streamed `Response` out, abort on disconnect, keys loaded from `.env` into the server process only. `vercel dev` remains available as `dev:full`.
  - **Gemini default model** `gemini-3.8-flash` (overridable with `GEMINI_MODEL`).
  - **No test files in `api/`.** Vercel deploys every `.js` file in `api/` as a function, so the handler tests live in `tests/api/`.
  - **`npm run llm:probe`** runs the real handlers per provider (plan, two populates, one edit) with fallback disabled, to judge each provider on the app's own path.
- **Why:** The forced-every-step policy was stricter than the agent needs and broke on the primary model. One `npm run dev` with no CLI or project link is simpler to run and to review.
- **Consequences:** Three `runTurn` tests (`tests/api`) cover the per-step tool choice, the Sarvam retry and fallback, and the forced single tool.

### D37. Sarvam runs non-streamed by default

- **Status:** Accepted (2026-10-15). Amends D35 (Sarvam provider) and D36. Completion checks in [D38](#d38-a-run-must-finish-its-job-plan-retries-7-character-ids).
- **Context:** First live edit turn: Sarvam started a `get_slide` call, then the stream failed with "Type validation failed" on a tool-call chunk. `sarvam-ai-sdk`'s streaming chunk schema rejects a field Sarvam sends in streamed tool-call deltas (its tool-call ids look like vLLM's, which sends `null` for fields the schema only allows to be absent). The same requests parse fine non-streamed: the forced `plan_deck` smoke test passed. Gemini answered 503 "high demand" on the same turn.
- **Decision:**
  - Sarvam calls run through `simulateStreamingMiddleware` unless `SARVAM_STREAM=true`: each step is one normal request, replayed as a stream. Tools, ops, chips and Stop work the same; assistant text arrives per step instead of per token, which matters little because the visible progress is ops landing on the canvas.
  - With `SARVAM_STREAM=true`, a "Type validation failed" error now also triggers the one non-streamed retry.
  - The SDK's own retry with backoff goes from 1 to 2 attempts, so a short 429/503 burst ("high demand") is absorbed before falling back to the next provider.
  - Each failed attempt is logged on the server (`[runTurn] <provider>: <message>`) so the full reason is visible in the Vercel or Vite logs; the SSE status carries only a truncated reason.
- **Why:** The non-streamed path is the one we've seen work. Patching the SDK's chunk parser through a custom `fetch` would mean guessing at an undocumented stream format under deadline.
- **Consequences:** Sarvam turns show "Thinking…" then chips appearing per step rather than streamed words. Revisit when `sarvam-ai-sdk` updates its chunk schema; `llm:probe` with `SARVAM_STREAM=true` re-checks it.

### D38. A run must finish its job; plan retries; 7-character ids

- **Status:** Accepted (2026-10-15). Amends D36 (populate check) and D24 (id length).
- **Context:** `llm:probe` on Sarvam (non-streamed): the forced `plan_deck` call came back after 13.6 s with an empty input (`{}`), so validation failed and the request ended `NO_PLAN` with no retry. An empty tool input is what a truncated or aborted tool call looks like. A flaky unit test also showed 5-character ids repeating about once per 16 runs of 2,000 ids.
- **Decision:**
  - `runTurn` takes `isComplete()`: populate = at least one op landed; plan = a valid plan arrived. A run that ends incomplete is a failed attempt, so it gets the same retry and fallback as an error, and the error says how the model finished (`finish: length` points to the token limit).
  - Sarvam's one retry: for a forced tool (plan) the same call again; otherwise with tool choice `auto`.
  - `/api/plan` gets `maxOutputTokens: 4000` (was 2500): Sarvam's reasoning tokens count against the limit.
  - Ids are 7 characters (32⁷ ≈ 34 billion). Client and server mint ids independently, so a repeat would make one op overwrite another element.
- **Why:** "Ended without doing the job" should be handled like an error, not reported as success or a dead end.
- **Consequences:** A new `runTurn` test covers the empty forced call being retried; the populate fallback test now uses `isComplete`.

### D39. Persistence and the StartScreen as built

- **Status:** Accepted (2026-10-15). Details D20 (persistence) and the user journey (StartScreen, "+ New").
- **Decision:**
  - **One workspace in IndexedDB** (`idb-keyval`, database `ai-presentation-builder`): `{ version, deck, messages, savedAt }`. On load the deck is validated with `DeckSchema`; unreadable data is moved to a backup key instead of being overwritten by the next autosave, and the user gets the StartScreen.
  - **Autosave** subscribes to the store: debounced 600 ms after the last change, but never more than 2 s behind (an AI run changes the deck and chat continuously, which would otherwise postpone saving until it ends), plus a flush when the tab is hidden or closed. The top bar shows "Saving…", "Saved", or a red "Not saved" if storage fails.
  - **Chat is saved with the deck.** A run that was streaming when the page closed comes back as stopped. Generation stores its slide briefs on the message as soon as the plan lands, so "Continue building" works after a reload; it fills only slides that still hold nothing but their title, so slides filled before the reload aren't duplicated.
  - **Screens:** `loading` (reading IndexedDB) → `start` (nothing saved, or "+ New") → `editor`. No router: one `screen` field in the UI slice.
  - **StartScreen:** one prompt box (Ctrl+Enter), slide count, four example chips (the first matches the reviewers' "chart and a table" test), "Start blank", "Open the sample deck". Generate switches to the editor immediately; the outline and skeleton slides appear there (no approval step, D12).
  - **"+ New"** (top bar, confirm when there is content) clears the deck, chat and saved workspace and returns to the StartScreen. The sample-deck button moved from the top bar to the StartScreen and the empty chat.
- **Why:** Refresh must restore the work, including a run interrupted by a reload; the first screen should say what the product does.
- **Consequences:** Single deck only (multi-project stays a Day 2 nice-to-have). "Restore previous deck" lasts for the session only (the replaced deck is not persisted). Seven persistence tests (fake-indexeddb) and a browser check: start screen, rename + reload, "+ New" + reload, generate + reload, reload mid-generation + "Continue building".
