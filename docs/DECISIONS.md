# Architecture decisions

The decisions that shape the system: the data model, the one path every change takes, the agent's contract with the UI, the stack, and why. D1–D23 come from an AI-assisted planning session before the build, checked with a throwaway canvas spike (drag, snap, resize, cross-slide move, undo on a sample deck); the later records changed or extended that architecture while building.

- Feature work, fixes from use and review, and polish are in the [build log](./BUILD_LOG.md).
- Options considered and **not** built are in [`TRADEOFFS.md`](./TRADEOFFS.md).
- Records in both files share one numbering, in the order they were written, so a reference such as "D56" in the code names exactly one record. The [timeline](./BUILD_LOG.md#timeline) lists every record from D24 on by date.

Each record: **Decision** · **Why** · **Consequences**. When a decision changes, the original record stays as written and gets a **Status** line naming the record that amends or supersedes it.

## Index

| Record                                                                                 | Decision                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [D1](#d1-one-op-language-one-dispatch)                                                 | One op language, one dispatch                                                |
| [D2](#d2-the-client-store-is-canonical)                                                | The client store is canonical                                                |
| [D3](#d3-normalized-schema-with-stable-ids)                                            | Normalized schema with stable ids                                            |
| [D4](#d4-element-model)                                                                | Element model                                                                |
| [D5](#d5-fixed-19201080-artboard)                                                      | Fixed 1920×1080 artboard                                                     |
| [D6](#d6-dom-based-renderer-one-sliderenderer)                                         | DOM-based renderer, one `SlideRenderer`                                      |
| [D7](#d7-drag-resize-and-snap-react-moveable-reorder-dnd-kit)                          | Drag, resize and snap: react-moveable; reorder: dnd-kit                      |
| [D8](#d8-continuous-slide-column)                                                      | Continuous slide column                                                      |
| [D9](#d9-layout-slots-and-clamping)                                                    | Layout slots and clamping                                                    |
| [D10](#d10-zustand--immer-patches)                                                     | Zustand + Immer patches                                                      |
| [D11](#d11-granular-tools-no-regenerate-path)                                          | Granular tools, no regenerate path                                           |
| [D12](#d12-two-phase-generation-orchestrated-by-the-client)                            | Two-phase generation, orchestrated by the client                             |
| [D13](#d13-compact-fresh-context-every-turn)                                           | Compact, fresh context every turn                                            |
| [D14](#d14-sarvam-as-the-primary-model-with-fallbacks)                                 | Sarvam as the primary model, with fallbacks                                  |
| [D15](#d15-streaming-ai-sdk-core-with-our-own-event-protocol)                          | Streaming: AI SDK Core with our own event protocol                           |
| [D16](#d16-tailwind-v4--shadcnui--lucide)                                              | Tailwind v4 + shadcn/ui + Lucide                                             |
| [D17](#d17-design-language)                                                            | Design language                                                              |
| [D18](#d18-vite--react-javascript-on-vercel)                                           | Vite + React (JavaScript) on Vercel                                          |
| [D19](#d19-code-organization-and-import-rules)                                         | Code organization and import rules                                           |
| [D20](#d20-persistence-in-indexeddb)                                                   | Persistence in IndexedDB                                                     |
| [D21](#d21-export-native-pptx-plus-a-print-view)                                       | Export: native PPTX plus a print view                                        |
| [D22](#d22-testing-and-evaluation)                                                     | Testing and evaluation                                                       |
| [D23](#d23-reliability-safety-nets)                                                    | Reliability safety nets                                                      |
| [D24](#d24-ops-are-id-anchored-and-fully-resolved)                                     | Ops are id-anchored and fully resolved                                       |
| [D25](#d25-ai-history-entries-are-contiguous-runs-of-one-turn)                         | AI history entries are contiguous runs of one turn                           |
| [D26](#d26-vanilla-zustand-store-react-binds-through-hooks)                            | Vanilla Zustand store; React binds through hooks                             |
| [D27](#d27-sarvam-through-its-official-ai-sdk-provider-on-ai-sdk-v7)                   | Sarvam through its official AI SDK provider on AI SDK v7                     |
| [D28](#d28-api-runs-as-plain-node-esm-layer-rules-enforced-by-eslint)                  | `/api` runs as plain Node ESM; layer rules enforced by ESLint                |
| [D29](#d29-react-19)                                                                   | React 19                                                                     |
| [D30](#d30-schema-v2-and-op-semantics-as-built)                                        | Schema v2 and op semantics as built                                          |
| [D31](#d31-collision-aware-placement)                                                  | Collision-aware placement                                                    |
| [D32](#d32-design-system-implementation)                                               | Design system implementation                                                 |
| [D35](#d35-the-agent-as-built)                                                         | The agent as built                                                           |
| [D37](#d37-sarvam-runs-non-streamed-by-default)                                        | Sarvam runs non-streamed by default                                          |
| [D38](#d38-a-run-must-finish-its-job-plan-retries-7-character-ids)                     | A run must finish its job; plan retries; 7-character ids                     |
| [D52](#d52-persistence-behind-a-four-method-store-tests-use-memory-not-fake-indexeddb) | Persistence behind a four-method store; tests use memory, not fake-indexeddb |
| [D57](#d57-stock-photos-from-openverse-with-wikimedia-commons-as-fallback)             | Stock photos from Openverse, with Wikimedia Commons as fallback              |
| [D58](#d58-images-described-once-by-a-vision-model)                                    | Images described once by a vision model                                      |
| [D59](#d59-react-router-owns-navigation)                                               | React Router owns navigation                                                 |
| [D63](#d63-a-full-slide-makes-room-instead-of-being-covered)                           | A full slide makes room instead of being covered                             |
| [D77](#d77-the-ai-can-lock-but-never-unlock)                                           | The AI can lock but never unlock                                             |
| [D79](#d79-stock-photos-from-wikimedia-commons-only)                                   | Stock photos from Wikimedia Commons only                                     |

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

- **Status:** Accepted; amended by D58 (each picture is described once by a vision model through `/api/describe`; chat requests still carry no image data, only that description as text).
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

- **Status:** Accepted; implementation details (fonts, fit, image framing, print scaling) in [D44](BUILD_LOG.md#d44-export-print-present-box-select-themes-deck-files).
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

## Refined during the build

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

- **Status:** Accepted (2026-10-15). Amends D18, D19. `maxDuration` raised to 120 s in [D35](#d35-the-agent-as-built). Local `/api` now runs inside the Vite dev server ([D36](BUILD_LOG.md#d36-tool-choice-per-step-local-api-in-vite-gemini-model)).
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

- **Status:** Accepted (2026-10-15). Details D7 and D9 (was an open item). Slots trimmed around existing content, lead/heading slots and auto-shrink added in [D41](BUILD_LOG.md#d41-content-spacing-lead-slots-trimmed-slots-auto-shrink).
- **Decision:** `placeElement` decides where a new element goes, in this order: an explicit bbox (clamped) → the preferred slot → the first free slot accepting the element's kind → the free spot nearest the requested position at the default size, then at 75% and 50% → overlap at the requested spot only if the slide is genuinely full. `findFreeSpot(slide, size, near, ignoreId)` searches a 40-unit grid ordered by distance from `near`, keeping the element's size (used for thumbnail drops and paste).
- **Why:** The brief asks for collision-aware drops; an AI-added second chart shouldn't land on top of the first.
- **Consequences:** Placement code runs in callers (tool layer, UI hooks), never inside `applyOp` (D24).

### D32. Design system implementation

- **Status:** Accepted (2026-10-15); motion durations and easings superseded by the motion tokens in D48. Details D16 and D17.
- **Decision:**
  - **shadcn components** (`button`, `tooltip`, `dropdown-menu`, `kbd`) were taken from the upstream new-york-v4 registry source and converted TSX → JSX by stripping types (what the CLI's JS mode does), because the registry was unreachable from the build sandbox. `components.json` (`tsx: false`, aliases into `src/primitives`) is committed so `npx shadcn add <name>` works on a developer machine. `button` is restyled for §8c (pill primary/secondary/outline/ai, 6px ghost icon buttons).
  - **`cn()`** lives in `src/primitives/cn.js` (UI-only), not `src/lib` (shared with `/api`). It registers the custom font-size tokens with tailwind-merge so `text-ui` isn't mistaken for a color.
  - **Token names:** shadcn's semantic names (`background`, `foreground`, `muted-foreground`, `border`, `primary`, `ring`, …) plus `panel`, `subtle`, `canvas`, `faint`, `user` (indigo), `ai` (saffron), `success`, `warning`. Dark mode is a `.dark` class on `<html>`, set before first paint by an inline script and persisted in localStorage.
  - **Chart palette** (slide theme `paper`): indigo, saffron, teal, violet, ochre, rose, assigned in fixed order. It passes the dataviz palette checks on white (lightness band, chroma floor, worst adjacent CVD ΔE 13.2, normal-vision ΔE 21.5, ≥ 3:1 contrast). It replaces the spike's palette.
- **Why:** Same components and behaviour as the CLI output, with one place to change chrome colors and a chart palette that stays readable for color-blind viewers and in print.
- **Consequences:** Fonts load from Google Fonts (Geist, Geist Mono, Instrument Serif). New shadcn components are added with the CLI on a dev machine, or ported the same way.

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

### D52. Persistence behind a four-method store; tests use memory, not fake-indexeddb

- **Status:** Accepted (2026-10-15). Amends D39 (persistence tests); the D39 consequences line mentions fake-indexeddb, which is gone.
- **Decision:** `services/kvStore.js` defines the store persistence writes to: `get / set / del / keys`. Two implementations: `createIdbStore()` (IndexedDB through idb-keyval, the same database `ai-presentation-builder` / store `kv` as before, so saved decks open unchanged) and `createMemoryStore()` (a Map that copies values in and out with `structuredClone`, as IndexedDB does). `persistence.js` uses the IndexedDB one; tests call `setStorage(createMemoryStore())`. The test-only `fake-indexeddb` dependency is removed.
- **Why:** the tests check persistence logic (5-project limit, eviction order, covers, autosave timing, legacy migration), not IndexedDB itself; a Map behind the same interface tests that with no IndexedDB emulator to install. The real IndexedDB path is checked in the browser.
- **Rejected:** a silent in-memory fallback when a browser blocks IndexedDB. The top bar would say "Saved" while nothing survives a reload; saving fails instead and the bar says "Not saved", as before. Also not switching idb-keyval for another wrapper: no reason to change the production library to change a test dependency.
- **Consequences:** 2 store tests (CRUD, copy semantics) plus the existing persistence tests on the memory store; 140 tests. Browser check: rename → autosave → reload restores the deck from IndexedDB, the recent list shows it.

### D57. Stock photos from Openverse, with Wikimedia Commons as fallback

- **Status:** Accepted (2026-10-16). Replaces the planned Pexels integration (Pexels is not issuing API keys to new accounts); amends D42 (images) and D44 (PPTX notes). **Amended by [D79](#d79-stock-photos-from-wikimedia-commons-only):** Openverse removed (its API stopped answering); Wikimedia Commons is the only source.
- **Decision:** the AI's `add_image` still runs on the server and adds a placeholder with a search query. A browser service (`services/photos.js`, started at boot) fills placeholders one at a time: **Openverse** first, then **Wikimedia Commons**, then the placeholder stays (the user can still replace it). Neither needs an API key, so there is nothing to configure and a reviewer's run can't fail on a missing variable.
- **Limits and fallback:** each provider has a gap between requests and a per-browser daily budget below its published limits (`PHOTO_LIMITS`: Openverse 3.5 s, 150/day, under its anonymous 20/min and 200/day; Wikimedia 0.5 s, 1000/day). A 429 (or 401/403) makes that provider rest for Retry-After, or 10 / 5 minutes; an error, an 8 s timeout or no usable result moves to the next provider. Budget and a small query cache (60 entries) live in localStorage, wrapped in try/catch (a blocked store only means a fresh budget). Searches run in the visitor's browser, so each reviewer has their own per-IP allowance, not one shared server quota. Only the search query leaves the browser; nothing goes to `/api` (D13).
- **Licences:** only CC0, Public Domain Mark and CC BY (Openverse `license=cc0,pdm,by`; Commons `LicenseShortName` checked against the same list). No share-alike, non-commercial or no-derivatives images, so a deck can be cropped, edited and shared with only a credit line. Raster images only (no SVG / GIF), no mature results.
- **Choosing and storing:** the result closest to the box's shape wins (the image is shown "cover"), small images (< 640 px) pushed back. The picture is downloaded (full image, else the thumbnail) and stored as a ≤ 1600 px JPEG data URL, like an upload, so saved decks and PPTX export don't depend on the source site later; if a host refuses a cross-origin read, the remote URL is kept (shows on the canvas; export reports it).
- **Credit:** `credit` on the image element (`text`, `url`, `license`, `source`). The image toolbar shows an (i) button with the credit line that opens the photo's page; PPTX export adds "Image: <credit> <url>" to that slide's speaker notes. Replace image clears it.
- **Edits and undo:** the fill is an AI change: it joins the AI turn's undo step when that turn is still the last entry (otherwise its own "AI: add photo" step). It never overwrites an image that was replaced, deleted, undone or re-queried while the search ran. Each query is tried once per element per session. When the AI changes an image's `query`, the image goes back to a placeholder and is filled again.
- **Short queries (from use):** the first live run left placeholders empty. The model wrote sentence-like queries ("community composting facility with residents sorting organic waste Pune India"), and photo searches match every word, so both sources found nothing. Now each source is tried with shorter forms of the query (`queryVariants`: filler words dropped, then the first 4, 3 and 2 words) before moving on; an unreachable source or a rate limit moves on at once. The tool description and prompt ask for 2–4 plain words, most important first, no place names (the limit stays 100 characters so a long query never fails the tool call). Every attempt is logged to the console as `[photos] …` (found, no results, rate limited, network or CORS error, download refused), so an empty placeholder can be explained. If a Wikimedia request fails, it is retried once without the `Api-User-Agent` header, in case the browser's preflight for that header is refused.
- **Rejected:** a server-side proxy (one shared quota for every reviewer, and image bytes would pass through `/api`); Unsplash (needs a key, 50 requests/hour in demo mode, hotlinking required); Pixabay (needs a key, no permanent hotlinking, links expire after 24 h).
- **Consequences:** 16 tests (query variants, shorter-query fallback, URL building, parsing and licence filter for both sources, picking, budget / rest, fallback on 429 / error / empty / spent budget, cache, filler joins the turn and undoes with it, no overwrite of a replaced image, query change resets, PPTX credit notes); 180 tests. Browser check with intercepted responses (the sandbox can't reach the real APIs): Openverse answers → photo on the sample deck's placeholder with credit "via Openverse"; Openverse 429 → Wikimedia photo with credit "via Wikimedia Commons"; both fail → placeholder stays, no errors. **Not yet checked against the live APIs** (CORS on Openverse's image hosts, real limits): do this on the deployed URL.

### D58. Images described once by a vision model

- **Status:** Accepted (2026-10-16). Amends D13 (no image data to `/api`) with one exception, chosen by Rohan from four options.
- **Problem (from use):** the AI only knew an image by its alt text ("lichess fen" for a chess position), because chat requests carry no image data (D13), so it couldn't say what a picture showed. sarvam-105b reads text only (Sarvam's docs list vision as a separate product), as does gpt-oss on Groq; Gemini is the one configured model that reads images.
- **Decision:** each picture is described once. A browser service (`services/captions.js`, started at boot) takes every image with a picture and no current description, makes a ≤ 768 px JPEG copy (white behind transparency) and sends it to `/api/describe`. Gemini returns at most ~70 words: what it shows, readable text and numbers, chart values, a game position. The text is stored on the element as `description: { text, of }`, where `of` is a fingerprint of the src it describes (`lib/imageInfo.js`). Chat requests send that text, never the picture: `toRequestDeck` keeps a current description and drops a stale one, and the deck context shows `shows: "…"` on the image line. Sarvam stays the chat model.
- **When it runs:** uploads, pastes, images inserted by URL and filled stock photos, one at a time, once per picture per session. A replaced picture (new fingerprint) is described again; undo/redo can't attach an old description to a new picture because the fingerprint wouldn't match. Pictures whose host refuses a cross-origin read can't be copied and stay undescribed. Without `GOOGLE_GENERATIVE_AI_API_KEY` the endpoint answers 503 and the service stops for the session; a 429 waits and retries. Console log `[describe] …`.
- **No undo step:** a description is metadata the user didn't make. `dispatch` gained `record: false`: same op path (`applyOp`, revision, autosave) but no history entry, and the redo stack stays. Undo of an edit applies path-based patches, which a new `description` field doesn't disturb.
- **Endpoint:** `/api/describe` accepts only a base64 JPEG data URL up to 600 KB plus the alt text, with the same per-IP rate limit as the chat endpoints; 25 s timeout. Image bytes go to Google's Gemini API for this one call (stated in the README). The picture is a `file` part with `mediaType: 'image/jpeg'`; AI SDK v7 deprecates the `image` part, and the endpoint test fails on any `AISDK_DEP` warning.
- **Rejected:** attaching the image to the chat turn when it's selected (sees more detail, but every such turn skips Sarvam and sends the image again); keeping text-only (the AI would stay blind to uploads).
- **Consequences:** 8 tests (fingerprint and stale description, request carries text not pixels, context line, describe once and again after a replace with no undo step, stop without a key, skip uncopyable pictures, no-record dispatch keeps undo/redo, endpoint with a mock model / 503 / JPEG-only); 188 tests. Browser check with `/api` intercepted: uploading a photo sends one 9 KB JPEG to `/api/describe`; the next chat request (5.7 KB) contains the description and no image data.

### D59. React Router owns navigation

- **Status:** Accepted (2026-10-16). Replaces D49's routing (`services/router.js`); requested by Rohan: "routing should happen via react router and not custom targeting of urls and state".
- **Before:** the store was the source of truth for the screen; a store subscription wrote the URL with `pushState`, and a `popstate` handler mapped the URL back onto store actions. Two-way sync by hand, with its own rules for push vs replace and for leaving Present.
- **Decision:** React Router 8.4.0 (`createBrowserRouter`, `RouterProvider`). The URL decides what is on screen; components and hooks navigate with `useNavigate` / `<Link>`, and nothing writes `history` by hand. Paths come from `lib/routes.js` (`deckPath`, `presentPath`, `slideIndexFrom`, `titleFor`).
  - `/` → `StartRoute`: closes the open project (saved; an AI run still going is stopped, e.g. Back mid-generation) and shows the StartScreen.
  - `/deck/:deckId` → `DeckRoute`: `useProjectRoute` loads that project unless it's already open; an unknown or evicted id redirects to `/` (replace). Renders the editor plus an `<Outlet>`.
  - `/deck/:deckId/present/:slide` → `PresentRoute` (child): Present on that slide, clamped to the deck (`/present/99` shows the last). The store's `presenting` mirrors the route, one way, for non-component code (keyboard and clipboard handlers, the canvas hiding its handles); leaving the route clears it and ends fullscreen.
  - `*` → redirect to `/`.
- **Navigation rules:** entering Present pushes (`state.fromEditor`), so Back leaves Present; moving between slides replaces, so Back doesn't walk through every slide; leaving goes `navigate(-1)` when entered from the editor, else replaces with the deck URL (a deep link or reload). Exit runs once (Esc also ends fullscreen, whose event would otherwise go back twice). Present tracks the slide it is heading to, so quick key presses count from the target, not from the slide still on screen. Recent-project cards are `<Link>`s (middle-click opens a new tab).
- **Workspace:** `services/workspace.js` no longer touches the URL. Starting a project (blank, sample, import, generate) returns the new deck id and `useWorkspace` navigates to it; open and close are called by the route components. Transitions run one at a time (a promise queue), so Back then Forward can't interleave a close with an open. `generateDeck` keeps the open project's id instead of minting a new one, so the URL and the saved project stay the same (it also stopped leaving an empty "Untitled" project behind). `ui.screen` stays as data ("a project is loaded"), not as the route.
- **Rejected:** keeping the store as the source of truth with React Router only rendering (two sources of truth again); data-router loaders for opening projects (the store, not the router, holds the deck, and opening needs the autosave flush first).
- **Consequences:** `services/router.js` and its tests removed; `lib/routes.js` with 3 tests; 189 tests. New dependency `react-router` 8.4.0 (MIT; peers React ≥ 19.2.7, Node ≥ 22.22). With `react-router` in `package.json`, Vercel's framework detection picked its React Router preset and looked for `build/` (`STATIC_BUILD_NO_OUT_DIR`); `vercel.json` now pins `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`. Browser check: `/` → sample → `/deck/:id` with the deck title in the tab; Present → `/present/1`, → → `/present/3` with no new history entries; Back leaves Present, Forward returns; Esc → `/deck/:id`; F5, End, → on the last slide exits; home → `/`, Back reopens the deck; deep link `/present/3` opens on slide 3 and Esc replaces to the deck; `/deck/d_nope` and `/what/ever` → `/`; `/present/99` → last slide; generating from the StartScreen lands on `/deck/:id` and stays; recent-project card `href` = deck path and opens it; earlier Present and selection checks pass; no page errors.

### D63. A full slide makes room instead of being covered

- **Status:** Accepted (2026-10-16). Amends D61 (its last fallback) and D54 (group thumbnail drops). Requested by Rohan: "can't we check overlapping and fix this issue?"
- **Decision:** `fitOnSlide(slide, boxes)` (`lib/layout/room.js`) places one element or a group (arrangement kept, scaled together) for a thumbnail drop and for the AI's `move_element` to another slide:
  1. a free spot near the old position at 100 / 75 / 50 / 35% (D61);
  2. else **make room** (`makeRoom`): the content area below the title is split into halves (right, left, bottom, top; nearest the old position first). The newcomer is fitted into a half at its proportions (at least 35%), and every element it would overlap gives way along that half's axis: narrowed (left/right) or shortened (top/bottom) so it ends where the newcomer begins, with a 24-unit gap. Text and tables shrink their text to fit, charts redraw, images re-crop. Never trimmed: the title, locked elements, elements lying entirely inside the half, or anything that would fall below a minimum size (text 240 × 80, chart 360 × 240, table 360 wide and 44 per row, image 200 × 140). The half that takes least area from existing content wins;
  3. only if no half works (e.g. the element in the way is locked): on top, clamped, so the drop still never fails.
  - The move and the trims are one dispatch: one undo step restores everything. The AI's tool emits the same ops (`move_element` + `update_element` bbox).
  - Replaces `groupToFreeSpot`, which after D61 could shift a group into a shrunk spot without scaling its members.
- **Consequences:** 4 tests (trims the element in the way and keeps the title and proportions; a locked element is never trimmed and the drop lands on top; a group scales and keeps its arrangement; the AI's `move_element` emits the trims and leaves no overlap); 197 tests. Sample deck, the 1100 × 740 chart onto each slide: slides 1 and 4 free spots; slide 2 the full-width bullets narrow to the right half; slides 3, 5 and 6 the side-by-side pair shortens and the chart takes the top half; no overlap anywhere. Browser check: drop onto slide 2's thumbnail → chart and narrowed text side by side, Ctrl+Z restores both.

### D77. The AI can lock but never unlock

- **Status:** Accepted (2026-10-16). Amends D30 (lock rules) for AI edits.
- **Problem (Rohan's review):** the brief says a lock holds "until unlocked", meaning by the user. `update_element` accepted `locked`, and `applyOp` lets a locked element take a patch that only unlocks it (that is how the user's Unlock works). So the model could call `update_element { locked: false }` and then move or delete the element in the same turn.
- **Decision:** `buildElementPatch` (`lib/agent/tools.js`) refuses `locked: false` on a locked element with `LOCKED: <id> is locked by the user; ask them to unlock it`, so the tool returns `ok: false`, nothing is emitted, and the model reads why. Locking (`locked: true`) is still allowed. The tool description says the AI cannot unlock. `update_elements` has no `locked` field. The user's Unlock (floating toolbar → `patchElement(id, { locked: null })`) goes straight to `applyOp`, not through `buildElementPatch`, so it is unchanged.
- **Consequences:** Tests: the AI's unlock is refused and the element stays locked with no op emitted; the AI can lock an unlocked element; the user can lock and unlock through the store action. 213 tests. JSDoc typedefs in `lib/schema/elements.js` brought in line with the Zod schemas at the same time (`groupId`; image `description`, `crop`, `natural`).

### D79. Stock photos from Wikimedia Commons only

- **Status:** Accepted (2026-10-16). Amends D57.
- **Problem (from use):** Openverse, the first photo source, stopped answering entirely, and its API keys can't be obtained either, so every image search spent a request and a timeout on it before reaching Wikimedia Commons. The docs also said both sources were "keyless" as if that guaranteed them: Commons has no API keys at all (anonymous use is the only mode), and an anonymous request can still be refused or time out.
- **Decision:** Openverse is removed from the code (`openverseUrl`, `parseOpenverse`, its limits and budget), the tests and the docs. `services/photos.js` searches Wikimedia Commons only, anonymously, with the same shorter-query fallback, 0.5 s gap, 1000-a-day per-browser budget, rest after a 429 and one retry without the `Api-User-Agent` header. When Commons is busy, unreachable or finds nothing, the image stays a placeholder, which the user can replace by an upload or a URL; the console logs why (`[photos] …`). Credits are `source: 'wikimedia'`; the schema still accepts `'openverse'` so decks saved with an Openverse photo keep loading, and the toolbar still names it for those.
- **Consequences:** Photo tests rewritten for one source: found and cached; rest after a 429 (the next search makes no request); network error with the header-less retry; shorter queries; spent budget makes no request. 213 tests.
