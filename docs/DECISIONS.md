# Architecture decisions

These decisions were made in an AI-assisted planning session before the build and validated with a throwaway canvas spike (drag, snap, resize, cross-slide move, undo on a sample deck). Alternatives that were considered and **not** built are recorded in [`TRADEOFFS.md`](./TRADEOFFS.md).

Each record: **Decision** · **Why** · **Consequences**. Status of all records: _Accepted_ (2026-10-15) unless marked otherwise.

When a decision changes during the build, the original record stays as written, gets a **Status** line pointing to the record that amends or supersedes it, and the changed part is ~~struck through~~. New records are appended (D24 onwards).

## Revision log

| Date       | Record                                                                                   | Change                                                                                                                                                                                                                | Affects            |
| ---------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-10-15 | [D24](#d24-ops-are-id-anchored-and-fully-resolved)                                       | Ops address slides and positions by id, carry resolved geometry and ids, and copies are id-based; `reorder_elements` naming; new `update_deck` op; tool → op mapping                                                  | D1, D3, D9, D11    |
| 2026-10-15 | [D25](#d25-ai-history-entries-are-contiguous-runs-of-one-turn)                           | One AI turn = one _contiguous_ history entry; a user edit mid-turn splits it                                                                                                                                          | D10                |
| 2026-10-15 | [D26](#d26-vanilla-zustand-store-react-binds-through-hooks)                              | Store created with `zustand/vanilla`; React binds through hooks                                                                                                                                                       | D10, D19           |
| 2026-10-15 | [D27](#d27-sarvam-through-its-official-ai-sdk-provider-on-ai-sdk-v7)                     | Sarvam through the official `sarvam-ai-sdk` provider on AI SDK v7 instead of the generic OpenAI-compatible provider                                                                                                   | D14, D15           |
| 2026-10-15 | [D28](#d28-api-runs-as-plain-node-esm-layer-rules-enforced-by-eslint)                    | `/api` as plain Node ESM with explicit `.js` imports; layer rules enforced by ESLint; Vercel function config                                                                                                          | D18, D19           |
| 2026-10-15 | [D29](#d29-react-19)                                                                     | React 19 kept after verifying react-moveable on it                                                                                                                                                                    | D18                |
| 2026-10-15 | [D30](#d30-schema-v2-and-op-semantics-as-built)                                          | Schema v2 details as built: optional text style filled from the theme, `caption` role, data-shape checks, `OpError` codes, lock and slot rules, deterministic `applyOp`                                               | D4, D9, D11        |
| 2026-10-15 | [D31](#d31-collision-aware-placement)                                                    | Placement: explicit bbox wins, then slot, then nearest free spot, shrinking to 75%/50% before overlapping                                                                                                             | D7, D9             |
| 2026-10-15 | [D32](#d32-design-system-implementation)                                                 | shadcn components ported from upstream source into JS (`components.json` kept for the CLI); `cn` in `primitives/`; token names; validated chart palette                                                               | D16, D17           |
| 2026-10-15 | [D33](#d33-store-and-canvas-as-built)                                                    | Store and canvas as built: props-only renderer with an interaction context, HTML chart legend, pie colors in data (Recharts 3), features reach the store only through hooks (lint-enforced), filmstrip insertion slot | D6, D7, D10, D19   |
| 2026-10-15 | [D34](#d34-dragging-across-a-scrolling-column-drop-ring-undo-reveal)                     | Drag survives scrolling (store-driven drag state, Moveable `scrollable` + replayed pointer, edge auto-scroll); overlay drop ring with label; undo/redo reveals the change from patch paths                            | D7, D10, D33       |
| 2026-10-15 | [D35](#d35-the-agent-as-built)                                                           | Agent as built: flat tools, plan → populate, `/api/agent` with provider fallback, chat panel                                                                                                                          | D14, D15           |
| 2026-10-15 | [D36](#d36-tool-choice-per-step-local-api-in-vite-gemini-model)                          | Tool choice forced on step 0 only, Sarvam retry in auto, `/api` served by Vite in dev, Gemini model                                                                                                                   | D35                |
| 2026-10-15 | [D37](#d37-sarvam-runs-non-streamed-by-default)                                          | Sarvam non-streamed by default (its streamed tool calls fail the SDK schema)                                                                                                                                          | D35                |
| 2026-10-15 | [D38](#d38-a-run-must-finish-its-job-plan-retries-7-character-ids)                       | A run must finish its job (`isComplete`), plan retried once, 7-character ids                                                                                                                                          | D35                |
| 2026-10-15 | [D39](#d39-persistence-and-the-startscreen-as-built)                                     | IndexedDB autosave, restore deck + chat, StartScreen                                                                                                                                                                  | D20                |
| 2026-10-15 | [D40](#d40-up-to-5-presentations-new-button-collapsible-panels-dark-slides)              | Up to 5 presentations, New button, collapsible panels, dark slides                                                                                                                                                    | D39, D17           |
| 2026-10-15 | [D41](#d41-content-spacing-lead-slots-trimmed-slots-auto-shrink)                         | Lead/heading slots, slots trimmed around content, text auto-shrink                                                                                                                                                    | D31                |
| 2026-10-15 | [D42](#d42-insert-menu-data-editors-floating-toolbar)                                    | Insert menu, chart/table data editor, floating toolbar                                                                                                                                                                | D33                |
| 2026-10-15 | [D43](#d43-chart-editor-and-side-panel-fixes-navigation-chips)                           | Chart editor axes, legend rule, one right panel, navigation, rectangular chips                                                                                                                                        | D42                |
| 2026-10-15 | [D44](#d44-export-print-present-box-select-themes-deck-files)                            | PPTX export, PDF print view, present mode, box select, themes, deck files                                                                                                                                             | D21                |
| 2026-10-15 | [D45](#d45-pptxgenjs-advisory-present-mode-takes-focus)                                  | pptxgenjs `image-size` pinned via overrides; present mode takes focus; F5 mid-edit                                                                                                                                    | D44                |
| 2026-10-15 | [D46](#d46-sage-replaces-sand-toolbar-stays-in-view-resizable-side-panel)                | Sage replaces Sand; toolbar kept in view; resizable side panel                                                                                                                                                        | D43, D44           |
| 2026-10-15 | [D47](#d47-one-menu-row-themed-dropdowns-and-scrollbars-whole-pixel-thumbnails)          | Shared `MenuItem`, themed dropdowns and scrollbars, whole-pixel thumbnails                                                                                                                                            | D44, D39           |
| 2026-10-15 | [D48](#d48-motion-tokens-speaker-notes-slide-transitions-ai-change-animation)            | Motion tokens, speaker notes, slide transitions, AI change animation, animated panels                                                                                                                                 | D32, D34, D40, D44 |
| 2026-10-15 | [D49](#d49-url-routing-canvas-stacking-cursor-token-notes-and-composer-spacing)          | URL routes (`/`, `/deck/:id`, `/deck/:id/present/:n`) synced with the store; canvas isolated below menus; resize cursor token                                                                                         | D39, D44, D48      |
| 2026-10-15 | [D50](#d50-top-bar-redesign-brand-mark-resize-cursor-shape-rename-spacing)               | Three-zone top bar, gradient brand mark, serif deck title, save state as icon; standard resize arrow in dark                                                                                                          | D40, D43, D49      |
| 2026-10-15 | [D51](#d51-chart-layout-axis-headroom-drawn-series-only-readable-numbers-ai-chart-rules) | Axis headroom with round ends, empty series not drawn, one tick format per axis; AI tools drop empty series and pick chart kind by data                                                                               | D43, D44           |
| 2026-10-15 | [D52](#d52-persistence-behind-a-four-method-store-tests-use-memory-not-fake-indexeddb)   | Persistence writes to a `get/set/del/keys` store: idb-keyval in the browser, a Map in tests; `fake-indexeddb` removed                                                                                                 | D39                |
| 2026-10-16 | [D53](#d53-copypaste-groups-spreadsheet-paste-image-crop-title-insert-tidy)              | Ctrl+C/X/V for elements (and images, cells, text from other apps); groups; spreadsheet paste into chart/table; image crop; Insert → Title; Tidy for overlapping slides                                                | D41, D42           |
| 2026-10-16 | [D54](#d54-groups-and-multi-selections-drag-to-other-slides)                             | Group / multi-select drags drop onto other slides (frame or thumbnail), arrangement kept, Alt copies                                                                                                                  | D33, D34, D53      |
| 2026-10-16 | [D55](#d55-table-rows-sized-to-their-text-present-ends-after-the-last-slide)             | Table rows take their text height (box grows for added rows, text shrinks if needed); Next on the last slide ends Present                                                                                             | D44                |
| 2026-10-16 | [D56](#d56-tidy-removed-click-inside-a-multi-selection-table-height)                     | Tidy removed; a click inside an ungrouped multi-selection selects that element; tables fill their box, start one row height per row                                                                                   | D53, D55           |
| 2026-10-16 | [D57](#d57-stock-photos-from-openverse-with-wikimedia-commons-as-fallback)               | AI image placeholders filled in the browser: Openverse, then Wikimedia Commons, then the placeholder; CC0 / PD / CC BY only; credits kept                                                                             | D13, D42, D44      |
| 2026-10-16 | [D58](#d58-images-described-once-by-a-vision-model)                                      | Each picture described once by Gemini via `/api/describe`; the AI sees the text, never the pixels                                                                                                                     | D13, D57           |
| 2026-10-16 | [D59](#d59-react-router-owns-navigation)                                                 | React Router 8: routes `/`, `/deck/:deckId`, `/deck/:deckId/present/:slide`; route components load or close projects; `services/router.js` removed                                                                    | D39, D49, D55      |
| 2026-10-16 | [D60](#d60-reading-order-title-first)                                                    | Reading order in the prompts (title, subtitle, main content, supporting text); while generating, AI boxes can't start above the title                                                                                 | D31, D41           |
| 2026-10-16 | [D61](#d61-drops-shrink-to-fit-readme-and-architecture-for-review)                       | Thumbnail drops / paste / AI cross-slide moves shrink (75/50/35%) before landing on content; README, architecture and review GIF written                                                                              | D31, D44, D48      |
| 2026-10-16 | [D62](#d62-toasts-and-modals-instead-of-browser-dialogs)                                 | Toasts (with Undo for deletions) and an in-app modal replace window.alert / confirm / prompt                                                                                                                          | D42, D44           |
| 2026-10-16 | [D63](#d63-a-full-slide-makes-room-instead-of-being-covered)                             | A drop (or AI move) onto a full slide trims the elements in the way instead of covering them                                                                                                                          | D61                |
| 2026-10-16 | [D64](#d64-no-content-above-the-title-cover-slides-stay-covers)                          | Auto-placed content never goes above the title; while generating, the cover refuses content and later title/section slides switch to the content layout                                                               | D60                |
| 2026-10-16 | [D65](#d65-planning-view)                                                                | Planning view: status card (prompt, steps) and themed skeleton slides and thumbnails with a saffron sheen                                                                                                             | D48                |
| 2026-10-16 | [D66](#d66-the-modal-closes-through-radix-never-by-unmounting)                           | The modal is closed through `open`, never unmounted while open; backdrop click cancels; a body-lock safety net                                                                                                        | D62                |
| 2026-10-16 | [D67](#d67-present-mode-survives-strictmode-fullscreen-ends-on-the-route-change)         | Fullscreen ends when the URL stops being a Present URL (watched by DeckRoute), not in an effect cleanup                                                                                                               | D59                |
| 2026-10-16 | [D68](#d68-audit-against-the-briefs-ai-requirements)                                     | Audit of the four AI requirements; end-to-end test for "drag a chart, the next AI turn sees it"                                                                                                                       | D11, D13, D23      |

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

- **Status:** Accepted; implementation details (fonts, fit, image framing, print scaling) in [D44](#d44-export-print-present-box-select-themes-deck-files).
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

- **Status:** Accepted (2026-10-15). Details D7 and D9 (was an open item). Slots trimmed around existing content, lead/heading slots and auto-shrink added in [D41](#d41-content-spacing-lead-slots-trimmed-slots-auto-shrink).
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

- **Status:** Accepted (2026-10-15); reveal-flash timing now from motion tokens (D48). Details D7, D10 and D33 (fixes found in manual testing).
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

- **Status:** Accepted (2026-10-15); what opens on load is decided by the URL since D49. Details D20 (persistence) and the user journey (StartScreen, "+ New"). Single workspace replaced by up to 5 projects, chat mode toggle and "Restore previous deck" removed in [D40](#d40-up-to-5-presentations-new-button-collapsible-panels-dark-slides).
- **Decision:**
  - **One workspace in IndexedDB** (`idb-keyval`, database `ai-presentation-builder`): `{ version, deck, messages, savedAt }`. On load the deck is validated with `DeckSchema`; unreadable data is moved to a backup key instead of being overwritten by the next autosave, and the user gets the StartScreen.
  - **Autosave** subscribes to the store: debounced 600 ms after the last change, but never more than 2 s behind (an AI run changes the deck and chat continuously, which would otherwise postpone saving until it ends), plus a flush when the tab is hidden or closed. The top bar shows "Saving…", "Saved", or a red "Not saved" if storage fails.
  - **Chat is saved with the deck.** A run that was streaming when the page closed comes back as stopped. Generation stores its slide briefs on the message as soon as the plan lands, so "Continue building" works after a reload; it fills only slides that still hold nothing but their title, so slides filled before the reload aren't duplicated.
  - **Screens:** `loading` (reading IndexedDB) → `start` (nothing saved, or "+ New") → `editor`. No router: one `screen` field in the UI slice.
  - **StartScreen:** one prompt box (Ctrl+Enter), slide count, four example chips (the first matches the reviewers' "chart and a table" test), "Start blank", "Open the sample deck". Generate switches to the editor immediately; the outline and skeleton slides appear there (no approval step, D12).
  - **"+ New"** (top bar, confirm when there is content) clears the deck, chat and saved workspace and returns to the StartScreen. The sample-deck button moved from the top bar to the StartScreen and the empty chat.
- **Why:** Refresh must restore the work, including a run interrupted by a reload; the first screen should say what the product does.
- **Consequences:** Single deck only (multi-project stays a Day 2 nice-to-have). "Restore previous deck" lasts for the session only (the replaced deck is not persisted). Seven persistence tests (fake-indexeddb at the time; an in-memory store since D52) and a browser check: start screen, rename + reload, "+ New" + reload, generate + reload, reload mid-generation + "Continue building".

### D40. Up to 5 presentations, "New" button, collapsible panels, dark slides

- **Status:** Accepted (2026-10-15); collapsed panels now stay mounted and animate (D48). Amends D39 (persistence, StartScreen), D35 (chat modes), D17 (dark mode) and the Day 2 "multi-project" nice-to-have, which this delivers.
- **Decision:**
  - **Projects.** IndexedDB holds up to 5 presentations: an index (`projects`: id, title, slide count, updated time, first slide as cover), one record per project (`project:<id>`: deck + chat), and the open project's id. Saving moves a project to the top; a 6th evicts the least recently updated one (the StartScreen says "the 5 most recent are kept"). An empty deck with no chat is never saved. The D39 single-workspace record is migrated once.
  - **StartScreen lists them** under the prompt ("Recent"): the first slide drawn by the real renderer, title, slide count, age; click to open, hover to delete (confirm). Reload returns to the open project; the StartScreen shows when none is open.
  - **"New" button** in the top bar (and the "AI" mark, as "All presentations") returns to the StartScreen. The open project stays saved, so there is no confirm. The chat no longer has an Edit/New deck toggle: it edits the open deck, and builds a deck only when that deck is empty ("Start blank"). Generation therefore never replaces a deck with content, so "Restore previous deck" was removed.
  - **Autosave across switches.** Autosave snapshots the project that changed; switching projects (a new deck id) is not an edit and is flushed first, so pending edits always land on the project they were made in.
  - **Collapsible panels.** Top-bar toggles (and Ctrl/Cmd + [ / ]) hide the slides panel and the AI panel; the canvas widens to fill. The layout is remembered per browser (localStorage, like the color scheme).
  - **Dark slides.** Slides follow the editor's scheme for display: theme `paper` has a dark counterpart `ink` (same fonts, sizes and roles; colors re-stepped; chart palette re-validated for the dark surface: lightness band, chroma, CVD worst ΔE 12.0, normal-vision 20.5, contrast ≥ 3:1). `getTheme(id, scheme)` picks it; export and print will use the deck's own theme. Slide frames get scheme-aware edge and shadow tokens (`--slide-edge`, `--slide-shadow`) so slides separate from the dark canvas. The scheme moved into the UI store so every component sees one value.
- **Why:** Requested after the first full run: people come back to more than one deck, expect a clear "New", want room for the canvas, and dark mode should not leave bright white slides.
- **Consequences:** 112 tests (persistence rewritten: round-trip, eviction to 5, empty not saved, invalid rejected, legacy migration, autosave debounce/maxWait/switch/error). Browser check: six decks created (one evicted), open from Recent, reload keeps the open project, delete, panels hide/show and survive reload, dark editor and StartScreen.

### D41. Content spacing: lead slots, trimmed slots, auto-shrink

- **Status:** Accepted (2026-10-15). Amends D31 (placement) and D9 (layout slots); closes the "auto-shrink" open item.
- **Context:** Generated slides showed a subtitle drawn over the bullets ("Pre-money valuation" on top of the list) and a column subtitle cut off by a table. Cause: content layouts had no slot for a subtitle, so it went to a free spot at the top of the content area; a slot (body, left column) was then filled at its full size, ignoring what was already there. Text taller than its box was clipped.
- **Decision:**
  - **Lead and heading slots.** `content` and `chart-focus` get a one-line `lead` slot under the title (subtitle, 76 high); `two-column` gets `leftHeading` / `rightHeading`. The body, column and visual slots start below them (y 320). Whatever order the model adds things in, a lead never lands on the body.
  - **Slots are trimmed to their free part** (`freePartOfSlot`): elements already inside a slot's area (hand-placed, AI-placed with coordinates, or in an overlapping slot) remove a vertical band plus a 24-unit gap; the largest remaining band is used, or the next slot if less than 120 units is left.
  - **AI coordinates never stack.** Tools pass `avoidOverlap`: if the model's explicit box collides with existing content, the element keeps its size and moves to the nearest free spot. A person's explicit placement is never moved.
  - **Auto-placed content stays out of the title band** (`CONTENT_TOP` 228) on layouts that have one.
  - **Auto-shrink** (render time): a text box whose content doesn't fit is drawn at the largest size that fits, in 4% steps down to the theme minimum (22 units), measured on the real DOM after web fonts load. The stored size is unchanged, so a bigger box or shorter text returns to full size.
- **Why:** Overlapping and clipped text is the most visible quality problem in generated decks.
- **Consequences:** Three new layout tests (trim below an existing element, lead above body when added after it, AI collision moved / person's kept). A browser check of the three reported cases shows 0 overlaps and 0 clipped boxes. Decks generated before this keep their positions; regenerate or move elements by hand. PPTX export needs the same shrink (the fitted size will be passed through).

### D42. Insert menu, data editors, floating toolbar

- **Status:** Accepted (2026-10-15). Delivers the Day 2 editing items of the plan (insert menu with image upload, chart data and table editors in a drawer, floating toolbar). Side-panel behaviour and chart editor reworked in [D43](#d43-chart-editor-and-side-panel-fixes-navigation-chips).
- **Decision:**
  - **Insert ▾** (top bar): text box, bulleted list, bar / line / pie chart, table, image from the computer or a URL, rectangle / ellipse / line / arrow. Starter content comes from `starterElement` (lib); `insertElement` places it like AI-added content (free slot, else nearest free spot below the title band). If the active slide has no room, the element goes on a new slide right after it, in the same undo step, instead of covering content. A new chart or table opens its data editor at once.
  - **Images** are downscaled in the browser to 1600 px on the long side (JPEG 0.85; PNG kept for transparency; SVG as is) before entering the deck, since every autosave writes the deck to IndexedDB and the PPTX embeds them. Images are never sent to `/api` (request contract).
  - **Data editors** open in a drawer that replaces the AI panel while open (Esc or × closes; it closes itself if the element disappears). Chart: type, title, a category × series grid with add/remove rows and series (≤ 24 rows, ≤ 8 series), legend toggle; numbers are typed as text and parsed on commit, so "-" or "1." can be typed. Table: cell grid, add/remove rows and columns (≤ 20 × 10), header row toggle. Each committed field (blur or Enter) or structural change is one undo step. External changes (undo, AI edits) re-sync the draft. Double-clicking a chart opens its editor.
  - **Floating toolbar** above the selection (flips below near the top), screen space beside the slide, hidden while dragging or editing text. Text: size −/+, bold, align, color (theme roles). Chart: bar/line/pie, Edit data. Table: Edit table. Image: replace, fill/fit. Shape: fill color. All: bring to front, send to back, lock, duplicate, delete.
- **Why:** The reviewers' script edits chart data and table rows by hand, inserts elements and moves them; editors live where the data is, and every edit stays one op through `dispatch`.
- **Consequences:** Two store tests (insert with free room; insert on a full slide adds a slide after it and leaves the slide untouched). Browser check: insert chart → drawer → edit value and category, add row and series, undo; toolbar chart type and text size/bold/align; insert table and edit a cell, add a column; upload a 2400 px PNG (stored at 1600 px); 0 overlapping elements on all slides afterwards. A bug found on the way: selecting a fresh wrapper object from the store (`findElement(...)`) re-rendered forever; components select the element itself.

### D43. Chart editor and side-panel fixes; navigation; chips

- **Status:** Accepted (2026-10-15); panel width amended by D46 (resizable), drawer entrance timing by D48 (tokens). Amends D42 (drawer, chart editor), D39/D40 (navigation) and D11 (chip style). From review of the first build.
- **Decision:**
  - **Chart editor:** sections Type · Title · Axes (X and Y axis labels; hidden for pie, which has no axes) · Show (values on the chart; Legend only where a legend is drawn) · Data. The grid uses fixed columns (category 116, series 92) and scrolls sideways beyond two series; every cell has a `title` with its full text. A pie edits only its first series; the others are kept for switching back.
  - **Legend rule in one place:** `legendAvailable(chart)` (pie, or two or more series) decides both whether the chart draws a legend and whether the editor offers the toggle. The legend now has its own line under the title, so a long legend no longer hides the title.
  - **One right-hand panel.** The data editor replaces the AI chat at the same width (360). Opening it shows the panel if it was collapsed; collapsing the panel closes it ("Hide side panel").
  - **The editor follows the selection:** selecting another chart or table switches it, clicking empty canvas or selecting anything else closes it.
  - **Focus moves to the editor** on open (first data cell, selected), with a short slide-in and indigo edge, and the header names the slide ("Chart · slide 3").
  - **Navigation:** the slides panel starts with "← All presentations" (plus the slide count); the top bar's "New presentation" is the primary dark pill. The deck title field grows with the window and shows the full title on hover.
  - **Op chips are rectangular:** neutral background, saffron left edge (the AI's color stays as the accent), "Show all N" instead of a dead "+N more".
- **Why:** Review feedback: missing axis controls, a panel that ignored the collapse toggle, truncated headings, no visible response to "Edit data", a legend toggle that did nothing, no obvious way back to the landing page.
- **Consequences:** Browser check covers each item (focus on the first cell, 360 width both panels, axis label rendered, legend toggle shown for 2 series and hidden for 1, pie hides axes and extra series, deselect closes, collapse closes, "All presentations" returns to the landing page), in dark mode.

### D44. Export, print, present, box select, themes, deck files

- **Status:** Accepted (2026-10-15); amended by D45 (image-size pin, present-mode focus), D46 (Sand replaced by Sage), D47 (Export menu rows), D48 (transitions, notes in Present) and D55 (table row height, Present ends after the last slide). Implements D21 and the Day 2 items "PPTX export + print view", "marquee select", "present mode", "JSON import/export", "themes"; resolves the "print view as a print-only container" open item.
- **Decision — PowerPoint (.pptx):**
  - **Pure mapping in `lib/export/pptx.js`** (deck → pptxgenjs calls, testable in Node), browser glue in `services/pptxExport.js`, pptxgenjs loaded on demand (its own 368 KB chunk).
  - **Exact geometry.** The 1920 × 1080 artboard is PowerPoint's 13.333 × 7.5 in "wide" slide: 144 units = 1 in, 2 units = 1 pt. Boxes, font sizes, line height (`lineSpacingMultiple`), paragraph gaps and table padding convert with those rules; text boxes have zero inner margin, as on the canvas.
  - **Fonts.** The web fonts aren't installed on most machines, and PowerPoint would substitute fonts of different widths, so the file names Cambria (titles) and Arial (text), which ship with Office. Text fit is **re-measured in the browser with those fonts** (metric-compatible fallbacks) and the fitted size is written, so a title that fit in Instrument Serif doesn't overflow in Cambria; `fit: shrink` is set as a PowerPoint-side backstop.
  - **Native objects.** Charts are real, editable PowerPoint charts (bar, stacked, line, area, pie as a 55% doughnut) with the theme palette, title, legend rule (`legendAvailable`), axis titles and value labels; stacked bars use centred labels (outEnd corrupts the file). Tables are native tables with the same header fill, banding, borders and padding. Bullets are real bullets (not "•" characters). Speaker notes go into the notes pane.
  - **Images** are drawn into a canvas at their box size with the canvas framing (cover/contain, 12-unit rounded corners) before embedding, so PowerPoint shows the same crop. A remote image whose site blocks cross-origin reads becomes a labeled placeholder and the user is told which.
  - **Known differences** (documented, accepted): bullet dots use the text color (pptxgenjs can't color bullets); chart titles are centred by PowerPoint; the value axis picks its own maximum; text wraps by PowerPoint's own metrics.
  - **QA:** the generated files pass the OOXML validator (schema, relationships, chart checks) and were rendered with LibreOffice side by side with the canvas for the sample deck and the spacing cases.
- **Decision — PDF:** a print view (portal, only mounted while printing) renders every slide with `SlideRenderer` at 1280 × 720 CSS px per page, `@page` 13.333 × 7.5 in, margins 0, backgrounds forced. It uses CSS `zoom`, not a transform: Chromium's PDF output dropped or double-scaled the SVG charts inside a scaled transform. Ctrl/Cmd+P opens it instead of printing the editor. Text stays selectable and charts vector.
- **Decision — Present:** fullscreen overlay, one slide scaled to the screen; → / Space / PageDown, ← / PageUp, Home / End, click to advance, Esc (or leaving fullscreen) exits; controls and cursor hide after 2 s. F5 from the start, Shift+F5 from the current slide. Editor shortcuts are off while presenting.
- **Decision — Box select:** dragging from a slide's background draws a selection rectangle (screen-space overlay inside the frame, clamped to the slide, never in layout) and selects every unlocked element it touches; Shift adds. A press without 4 px of movement still deselects. It starts only on the background, never on an element or Moveable's handles, so it can't steal a drag or resize, and it stays within one slide (groups never span slides).
- **Decision — Themes:** picker with Paper, Sand (warm light; dark display variant Ink) and Midnight (a dark deck). Our own colors, the same OFL fonts; every chart palette validated. Changing theme is one undoable op and applies to export.
- **Decision — Deck files:** Export → Deck file (.json, `{ format, version, deck }`); "Open a deck file" on the StartScreen validates it with `DeckSchema` and opens it as a new project (fresh id).
- **Third-party list** in `docs/THIRD_PARTY.md` (fonts OFL 1.1; libraries MIT / ISC / Apache-2.0; `sarvam-ai-sdk` declares no license, flagged).
- **Consequences:** 6 export unit tests (geometry, colors, fit cap, bullets, chart rules, full write twice). Browser check: insert an uploaded image, box select 3 elements, switch to Sand, download .pptx (validated, rendered), print view (7 pages, unmounts after printing), present (F5, →→, Esc), deck file export and re-import.

### D45. pptxgenjs advisory; present mode takes focus

- **Status:** Accepted (2026-10-15). Amends D44 (export dependency, present mode).
- **Context — the advisory:** `npm audit` reports two high-severity issues in `image-size` ≤ 2.0.2 (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr: infinite loops parsing JXL/HEIF/ICNS files, a denial of service). pptxgenjs 4.0.1 declares `image-size ^1.2.1`, but none of its builds import it (its only size lookup is a Node-only `require('sizeof')`), our browser bundle doesn't contain it, and we always pass image data with explicit sizes.
- **Decision:** keep pptxgenjs and pin the patched `image-size` 2.0.4 with npm `overrides` (scoped to pptxgenjs). `npm audit` reports 0 vulnerabilities.
- **Why not replace pptxgenjs:** there is no maintained alternative that writes native, editable charts and tables in the browser (officegen is Node-only and unmaintained; pptx-automizer edits templates in Node). Writing OOXML ourselves with JSZip means weeks of chart XML for no security gain, since the flagged code never runs.
- **Decision — present mode and editor state:** while presenting, the canvas's Moveable handles and floating toolbar unmount (Moveable's control box sits in a z-index 3000 layer and floated over the presentation). The selection is kept, so Esc returns to the same state. On entry, the focused editor element is blurred (an open text edit commits through its normal blur path) and focus moves to the presentation, so keys can't reach a text box behind it. The overlay sits at z-index 5000.
- **Decision — F5 inside text:** inline editors stopped every keydown to keep typing away from canvas shortcuts, which also hid F5 from the app and let the browser reload the page mid-edit. `stopEditorKeys` lets F5 / Shift+F5 and Ctrl/Cmd+P through; the global handler checks them before the text-field guard.
- **Consequences:** browser check: selected chart → Present shows no handles, focus on the presentation, handles return after Esc; mid text edit → F5 presents, the edit is saved, typed keys don't leak into the text.

### D46. Sage replaces Sand; toolbar stays in view; resizable side panel

- **Status:** Accepted (2026-10-15). Amends D44 (themes) and D43 (right panel fixed at 360).
- **Themes:** Sand read as a copy of Paper (near-white background, dark text), and in dark mode both showed as Ink, so switching between them changed nothing on screen. **Sage** replaces it: green-tinted background `#eef2ea`, forest accent, its own dark counterpart **Moss** (`#10251b`), so Paper, Sage and Midnight differ in both editor modes. Both chart palettes pass the dataviz checks. Saved decks with `theme: 'sand'` open as Sage (`LEGACY_IDS`). The picker shows a small slide preview (background, title in the heading font, body line, two chart bars) in the variant the canvas will display, plus a one-line description.
- **Floating toolbar:** it isn't a stacking problem: the slide column clips horizontally (`overflow-x: hidden`), so a toolbar for an element on the right half was cut off at the panel edge. The toolbar's width is measured (ResizeObserver, before paint) and it is shifted left to stay within the slide plus 56 px of the column's padding.
- **Side panel:** the AI chat and the data editor share one width (`ui.sideWidth`, 320–760 px, default 360, kept per browser in localStorage). Drag the panel's left edge (pointer capture, live), use ←/→ on the focused handle, double-click the handle or press the header's Widen/Narrow button to switch between 360 and 560. The panel never squeezes the canvas below ~520 px.
- **Consequences:** 3 new unit tests (Sand → Sage/Moss, pickable themes have distinct backgrounds in both modes, width clamp). Browser check: toolbar inside the column for all 16 sample elements; widen 360 → 560, drag → 464, chart editor opens at 464, width survives reload; theme previews and Sage in dark mode.

### D47. One menu row, themed dropdowns and scrollbars, whole-pixel thumbnails

- **Status:** Accepted (2026-10-15). Amends D44 (Export menu layout) and D39 (slide-count picker).
- **Menus:** `primitives/MenuItem.jsx` is the one menu row (icon, one-line label, optional `Kbd` shortcut chip, the same chip the tooltips use). Insert and Export both use it; Export's two-line descriptions moved to `title`. The StartScreen's slide count is a `DropdownMenu` radio group (a native `<select>` can't be themed and rendered with OS colors in dark mode).
- **Scrollbars:** app-wide, in the app's colors: no arrow buttons, 10 px with a rounded thumb on a clear track, lighter in dark mode. WebKit pseudo-elements for Chromium/Safari; `scrollbar-width`/`scrollbar-color` only where those don't exist (Chromium ignores the pseudo-elements once `scrollbar-color` is set).
- **Filmstrip thumbnails:** 176 × 99 (was 184 × 103.5). The half pixel, at Windows display scaling, made the selection ring (on a wrapper) and the slide edge (on the preview) round differently, leaving a gap between them; the drag overlay looked right because both were on one element. The ring now replaces the edge on the preview itself. The filmstrip never scrolls sideways and reserves a stable gutter, so a classic 17 px scrollbar can't push thumbnails out of view.
- **Consequences:** browser check at 1.25× device scale in dark mode: count picker sets "Slides: 6", Export rows single-line with a Ctrl P chip, filmstrip `scrollWidth == clientWidth`, thumbnail exactly 176 × 99.

### D48. Motion tokens, speaker notes, slide transitions, AI change animation

- **Status:** Accepted (2026-10-15). Replaces the ad-hoc durations in D32 ("one easing, three durations" comment), D34 (reveal flash) and D43 (drawer entrance); amends D44 (present mode) and D40 (panels unmount when collapsed).
- **Motion tokens (design system).** Defined once in `styles/index.css`: durations `--motion-fast` 120 ms (hover, press, small fades), `base` 200 ms (open/close: menus, tooltips, panels, notes), `move` 280 ms (something travels: AI moves, slide transitions, drag drop), `emphasis` 420 ms (entrance meant to catch the eye), `highlight` 1100 / `highlight-ai` 1600 ms (change flashes); easings `--motion-ease-standard / enter / exit`. Tailwind gets `duration-fast|base|move|emphasis` (they also set `--tw-duration`, so tw-animate's `animate-in/out` pick them up) and `ease-standard|enter|exit`; CSS uses `var(--motion-*)`; scripted animations read the same variables through `hooks/motion.js` (`motion('move', 'enter')` → WAAPI options; 0 ms under reduced motion). `tests/motion-tokens.test.js` fails on any raw duration, `cubic-bezier`, numeric `duration-N`, or a transition / animate-in class without a duration token, outside the token block. Looping indicators (spin, pulse, ping) keep Tailwind's built-in timing.
- **Speaker notes.** A notes line under every slide on the canvas: a faint "Add speaker notes" or the first two lines of the notes; click to edit in an auto-growing textarea; click away saves as one undoable op ("Edit speaker notes", `setSlideNotes`), Esc restores. In Present, **N** (or the notes button in the controls) toggles a notes panel for the slide on screen. Notes already export to the PowerPoint notes pane (D44).
- **Slide transitions.** `deck.transition`: `none | fade | push` (default fade; schema default fills older decks; `update_deck` op). Set from the new Present ▾ split button (also "From the beginning F5" / "From this slide Shift+F5"). Present keeps the leaving slide as a second layer for one transition; Push follows the direction of travel. Not written to .pptx: pptxgenjs has no transition API (documented gap).
- **AI changes animate on the canvas.** When an AI op lands (new `aiFlash.seq`), the frame diffs the slide before and after (not just aiFlash's ids: several ops in one network chunk render once): moved or resized elements glide from the old box (left/top/width/height, so text reflows instead of stretching), new elements fade and grow in, deleted ones leave a read-only ghost that fades out. A slide added mid-turn rises into place. User edits and undo don't animate this way (undo keeps its indigo reveal flash). The store now records `removedIds` per slide for AI ops; a removal-only op doesn't flash the whole slide.
- **Panels** stay mounted and animate their width open/closed (`PanelSlot`, `base` token), so the chat keeps its draft and scroll while hidden; a closed panel is `inert`. Dragging the side panel's edge turns transitions off so the panel follows the pointer.
- **Consequences:** 131 unit tests (guard test, AI change tracking, transition/notes ops, schema default). Browser check: tokens resolve; add notes, preview, undo; Present with Push shows exit + enter layers then one; notes panel shows slide 2's notes; a mocked AI turn that moves, deletes and adds in one chunk produces a glide, a fade-in and a ghost that cleans itself up; the side panel animates closed.

### D49. URL routing; canvas stacking; cursor token; notes and composer spacing

- **Status:** Accepted (2026-10-15); routing replaced by D59 (React Router; the URL, not the store, decides the screen). Amends D39 (boot reopened "the last open project"; the URL decides now).
- **Routes:** `/` StartScreen · `/deck/:id` editor · `/deck/:id/present/:n` Present on slide n. `services/router.js`, no router library: the store stays the source of truth and the app has three routes, so a subscription that writes the URL and a `popstate` handler that calls the existing workspace actions (open project, go to start, present) is ~100 lines and keeps every button working unchanged. Pushes for a new screen, project or entering Present; replaces while stepping slides in Present (Back leaves the presentation instead of walking through slides); leaving Present steps back to the editor entry instead of stacking a duplicate. A route that can't be shown (an unsaved or evicted deck) falls back to `/` with `replaceState`. `document.title` follows the deck title. Boot reads the URL; recent-project cards are real links (middle-click opens a new tab). Vercel rewrites every non-`/api` path to `index.html` so deep links load.
- **Canvas stacking:** the slide column is `isolate`, so Moveable's z-index 3000 handles, the toolbar and flashes stack inside it and menus/tooltips (portals on `<body>`, z-50) always draw above them. Found when the Export menu opened under a selected element's outline.
- **Cursor token:** `--cursor-resize-x`, a dark double arrow with a white outline (SVG), with `col-resize` as fallback; Windows draws `col-resize` white, nearly invisible on the light panel. Used by the side panel's resize edge and while dragging it.
- **Spacing:** 12 px between the speaker-notes label and its box; the chat composer's textarea is one 20 px line plus 6 px padding = the 32 px send button, so placeholder, caret and button share a centre line.
- **Consequences:** 2 route tests (parse, state → route round trip). Browser check: `/` → open sample → `/deck/:id` with the deck title as page title; F5 → `/present/1`, →→ → `/present/3` (replaced), Esc → `/deck/:id`; Back → StartScreen, Forward → same deck; reload on `/present/2` presents slide 2; unknown deck → `/`; Export menu draws over the selection outline; composer centre offset 0; resize cursor is the SVG token.

### D50. Top bar redesign, brand mark, resize cursor shape, rename spacing

- **Status:** Accepted (2026-10-15). Amends D40/D43 (top bar layout, the "AI" home button) and D49 (cursor shape).
- **Why:** the bar was one flat row, and its indigo "AI" tile used the _user's_ color for the product mark while saffron means the AI everywhere else; nothing in the editor carried the StartScreen's identity.
- **Mark:** `primitives/BrandMark.jsx`, two stacked slides; the front one carries the StartScreen's saffron → periwinkle wash (AI color into user color). It is the home link ("All presentations"). The one bold element in the bar; everything else stays neutral.
- **Layout:** a three-column grid so the middle is centred on the window: left = slides-panel toggle, mark, deck title in Instrument Serif (the face of slide titles and the StartScreen heading, sized to its text), save state as a cloud icon right after the title (meaning in the tooltip / `role=status`; only an error shows text); centre = the canvas tools in one quiet group (undo/redo · Insert, Theme with a label now); right = what leaves the editor (Export, Present ▾, New) then app settings (dark mode, side panel) behind a divider. Below 1280 px "New presentation" folds to its + icon so the centre group keeps its room.
- **Cursor:** back to the plain double-headed resize arrow the user liked, drawn dark with a thin white outline (browsers can't recolor a system cursor; Windows draws it white). Fallback `ew-resize`.
- **Filmstrip:** 8 px between a thumbnail and its title / rename field.
- **Consequences:** browser check at 1440 (light, dark) and 1180: centre group offset 0 px, nothing overlaps at 1180, rename gap 8 px.

### D51. Chart layout: axis headroom, drawn series only, readable numbers; AI chart rules

- **Status:** Accepted (2026-10-15). Amends D43 (legend rule now counts drawn series) and D44 (export axis range); closes the "AI chart quality" item.
- **Problem (from use):** value labels on the largest bar or point collided with the legend row and the top axis tick; line points sat on the value axis; all-zero "Series 3 / Series 4" got legend entries and rows of "0".
- **Decision (`lib/chart.js`, shared by canvas, editor, export and AI tools):**
  - `visibleSeries`: empty series (all 0 / missing) aren't drawn or listed; they stay in the data, so the editor still shows them. If every series is empty, all are kept so the chart still has axes. Colors keep the series' original slot, so hiding one never recolors the others.
  - `valueDomain`: the value axis ends at a round number (1, 1.2, 1.5, 2, 2.5 … × 10ⁿ) about 12% above the largest value (stacked bars: the largest total; negatives get the same room below zero), so the top label sits inside the plot. The PowerPoint export uses the same range.
  - Plot top margin fits one label line; line/area charts start 40 units in from the axis; stacked segments label in the middle in the on-accent color.
  - Numbers: an axis uses one format, chosen by its range (0 · 4K · 8K · 12K · 15K once it passes 10,000); data labels show exact values with grouping (12,000).
- **AI side:** `add_chart` / `update_chart_data` drop empty series and refuse a chart with no numbers (the model gets an error it can act on). The tool description and generation prompt say: bar to compare categories (TAM/SAM/SOM, segments, plans), line/area only for a measure over time, pie only for parts of one whole.
- **Consequences:** 4 new tests (empty-series rule, round axis ends, headroom incl. stacked and negative, tool drops empty series). Browser check with the reported data (12,000 / 180 / 12 plus two all-zero series) as bar and line in dark mode: no overlap, axis 0–15K, exact labels, no legend (one drawn series, named by the title).

### D52. Persistence behind a four-method store; tests use memory, not fake-indexeddb

- **Status:** Accepted (2026-10-15). Amends D39 (persistence tests); the D39 consequences line mentions fake-indexeddb, which is gone.
- **Decision:** `services/kvStore.js` defines the store persistence writes to: `get / set / del / keys`. Two implementations: `createIdbStore()` (IndexedDB through idb-keyval, the same database `ai-presentation-builder` / store `kv` as before, so saved decks open unchanged) and `createMemoryStore()` (a Map that copies values in and out with `structuredClone`, as IndexedDB does). `persistence.js` uses the IndexedDB one; tests call `setStorage(createMemoryStore())`. The test-only `fake-indexeddb` dependency is removed.
- **Why:** the tests check persistence logic (5-project limit, eviction order, covers, autosave timing, legacy migration), not IndexedDB itself; a Map behind the same interface tests that with no IndexedDB emulator to install. The real IndexedDB path is checked in the browser.
- **Rejected:** a silent in-memory fallback when a browser blocks IndexedDB. The top bar would say "Saved" while nothing survives a reload; saving fails instead and the bar says "Not saved", as before. Also not switching idb-keyval for another wrapper: no reason to change the production library to change a test dependency.
- **Consequences:** 2 store tests (CRUD, copy semantics) plus the existing persistence tests on the memory store; 140 tests. Browser check: rename → autosave → reload restores the deck from IndexedDB, the recent list shows it.

### D53. Copy/paste, groups, spreadsheet paste, image crop, Title insert, Tidy

- **Status:** Accepted (2026-10-16); Tidy removed and multi-selection clicks amended by D56. Delivers the brief's nice-to-haves "copy / paste elements between slides", "paste from an external spreadsheet into a table or chart", "group / ungroup", "image crop"; amends D42 (Insert menu) and D41 (spacing: a fix for older decks).
- **Copy / cut / paste (`lib/clipboard.js`, `hooks/useClipboard.js`):** through the browser's `copy` / `cut` / `paste` events, so no permission prompt and copies work between tabs. The selection goes on the clipboard as our own type (`application/x-aipb-elements+json`, whole elements in z-order) plus plain text for other apps; a match on that plain text is the fallback where the custom type is dropped. Paste lands on the clicked slide with fresh ids, slots dropped, groups re-made as new groups: first paste onto another slide keeps the position, onto the same slide (or again) steps 40 units down-right. One undo step. Pasting from elsewhere: an image file → image element, spreadsheet cells → a table (editor opens), other text → a text box. Fields keep normal text copy/paste.
- **Clicking a slide makes it the current one** (capture-phase pointerdown on the frame), so paste, Insert and "Present from this slide" use the slide that was clicked, not the one the scroll tracker last picked. Found when a paste landed on the slide above.
- **Groups (`lib/groups.js`):** `groupId` on elements (one slide); dragging a group to another slide was added in D54. Selecting any member selects the group (click, Shift-click, box select); it moves, copies and deletes as one; Ctrl/Cmd+G groups, +Shift ungroups, and the toolbar shows Group / Ungroup for multi-selections. Duplicate and paste give copies a new group. Locked elements may join or leave a group (it doesn't move them). The AI's deck summary shows `group=`. PowerPoint export writes members as separate shapes (pptxgenjs has no groups).
- **Spreadsheet / CSV paste (`lib/tabular.js`):** tab-separated (spreadsheet copy) or CSV/semicolon text with RFC 4180 quoting. Numbers read like a spreadsheet's ("₹1,200", "12%", "(40)") but "Q1" stays a label. Chart editor: pasting a grid replaces the data — categories down, series across, names from a header row (text, or years over non-year values); data laid out across is turned round; blanks count as 0; capped at 24 × 8 with a note. Table editor: a grid pasted into a cell fills right and down, growing the table up to 20 × 10.
- **Image crop (`lib/crop.js`, `features/drawer/ImageCropEditor.jsx`):** `crop` (fractions of the source) and `natural` (source px) on image elements. The renderer covers the box with the crop region (percent-based, so it follows a live resize; never stretched); the crop editor sits in the side panel with the whole picture, a frame in the box's shape (drag to move, corners to resize, arrows / + / − on the keyboard, Zoom in/out, Reset). Replace image clears the crop. PPTX export draws the same region.
- **Insert → Title:** a title text box, placed in the title slot when the layout has a free one.
- **Tidy (`lib/layout/tidy.js`):** a "Boxes overlap · Tidy" chip on slides whose boxes clash (more than 4% of the smaller box; shapes and same-group pairs don't count). Tidy keeps locked, grouped and shape elements and the title where they are; anything clashing first tries straight down below what it hits (same left edge, 24-unit gap), then the nearest free spot, shrinking to 50% at most. One undo step; moved elements are selected and flashed.
- **Consequences:** 161 tests (parser, chart/table from grids, crop geometry, schema crop bounds, copy/paste ops, groups incl. duplicate and locked, tidy incl. fixed elements). Browser check on a deck with an overlap: Tidy fixes it and undo restores it; Title inserts; copy → paste on another slide at the same place, again +40; cut → paste across slides; grid paste → table, text paste → text box; group selects as one, ungroup; chart paste "Pasted 3 rows, 2 series" with year headers; table paste grows the table; crop editor → cropped canvas; PPTX with a crop passes the validator and embeds the cropped region.

### D54. Groups and multi-selections drag to other slides

- **Status:** Accepted (2026-10-16). Amends D7/D33/D34 (cross-slide drag was single-element only) and D53 (groups).
- **Problem (from use):** a group couldn't be dragged to another slide. Moveable's group-drag handlers had no drop target at all, only a same-slide move, so any multi-selection was stuck on its slide; groups (always a multi-selection) made it obvious.
- **Decision:** group drags use the same drop rules as single drags. While dragging: hit-test, drop ring and the "Hold Alt to copy · Esc to cancel" badge. On release over another slide's frame, each element lands where it was released, converted into that slide's units; over a thumbnail, the group goes to the free spot (for its outline) nearest its old position (`groupToFreeSpot`). Either way the group is shifted inside the artboard as one piece (`shiftGroup`), so members keep their arrangement instead of being clamped one by one. Alt copies; copies form a new group. All moves are one dispatch, one undo step. Esc still cancels and restores.
- **Consequences:** 2 tests (edge shift keeps offsets; thumbnail drop avoids content and keeps offsets). Browser check with real mouse drags: grouped pair → slide 5 thumbnail (ring "Move to slide 5", offsets kept, undo restores both), → next slide's frame ("Move to slide 3"), Alt → slide 6 thumbnail ("Copy to slide 6", originals stay, the copies select as one group).

### D55. Table rows sized to their text; Present ends after the last slide

- **Status:** Accepted (2026-10-16); table height amended by D56 (rows fill the box again; new tables start one row height per row). Amends D44 (present mode) and the table renderer / export.
- **Problem (from use):** table rows were stretched to fill the box (a 4-row table in a 420-unit box gave 105-unit rows), so tables looked sparse. In Present, Next on the last slide was clamped to the last index, so the presentation never ended.
- **Table rows:** the table sits at the top of its box and rows take the height of their text (14 pt, padding in em, about 64 units a row). If rows outgrow the box the text shrinks to fit, like a text box (`fitFontSize` / `useFittedSize`, moved to `elements/fit.js` and shared with `TextEl`), down to 18 units for tables. Adding rows in the table editor grows the box to fit them (`tableBoxFor`, never shrinks it, stays above the safe margin), in the same undo step. Header borders take the header colour, no dark seams. PPTX export writes the same 64-unit row height and cell margins.
- **Present:** →, Space, Enter, PageDown, a click and the HUD's › on the last slide end the presentation (as PowerPoint and Keynote do); the URL goes back to `/deck/:id`. The › label reads "End presentation" there. ← on the first slide and End / Home still clamp.
- **Consequences:** 1 test (`tableBoxFor` grows, caps, never shrinks); 164 tests. Browser check: 4-row table rows 64 units each; pasting 12 rows into the editor grows the box and everything fits (no clipped rows); → and click on the last slide exit Present; F5 then End stays on the last slide; ← steps back.

### D56. Tidy removed; click inside a multi-selection; table height

- **Status:** Accepted (2026-10-16). Amends D53 (Tidy, groups) and D55 (table height).
- **Tidy removed:** it wasn't in the brief, and in use it didn't move boxes well enough to trust. The chip, `tidySlide` (action and `lib/layout/tidy.js`) and its tests are gone; `findOverlaps` went with it. D41's spacing rules still keep new content from overlapping.
- **Click inside a multi-selection (from use):** after Ungroup every element stayed selected, and clicking one of them didn't select it on its own. Moveable covers a multi-selection with one drag area, so the click never reached the element; it ended as a group drag that didn't move. Now a click with no drag resolves under the pointer (`clickInSelection` in `CanvasMoveable`): a single group stays selected as a unit; otherwise the topmost element under the pointer becomes the selection (Shift toggles it), and a click on empty space between them clears it, as in PowerPoint and Figma. Dragging a multi-selection still moves them all. Ungroup itself still leaves the members selected, as PowerPoint does.
- **Table height (from use, two rounds):** D55 drew rows at their text height at the top of the box, so the box (selection outline, hit area) was taller than the table. A first fix made the element's box follow the table, with `bbox.h` only a ceiling; that broke resizing, since dragging a handle down did nothing. Final rule, as in PowerPoint: the table fills its box and the rows share the height, each at least one line of text plus padding (`2.2em`, so empty rows keep their height). What was sparse before was the starting size, so new tables start one row height (64 units) per row: Insert, paste and AI `add_table` without explicit coordinates use `tableBoxAt`; the sample table is 256 units. In the table editor the box follows the row count while it is still sized to its rows, and a box someone stretched keeps its height and only grows when needed (`tableBoxFor`). A table can't be resized below 44 units a row (CSS `min-height`, which Moveable honours); between that and the box the text shrinks. PPTX export: row height = box height ÷ rows, at least 64 units. Rejected: writing the measured height back into the deck after each render; every load or font change would add an undo step, or need a dispatch that skips history and breaks the one-dispatch rule (D2).
- **Consequences:** 164 tests (tidy tests removed; table box rules added). Browser checks: no Tidy chip; group → click member keeps the group; ungroup → click the table selects only it; two selected → click the text box selects only that; dragging a pair still moves both. Sample table 256 units, inserted table 192, table fills the box; dragging the bottom handle down stretches the rows (48 px each) with the handle on the table's edge; dragging far up stops at 4 × 44 units with the text at 19 px and nothing clipped; undo restores; 13 pasted rows fit; Present exit unchanged.

### D57. Stock photos from Openverse, with Wikimedia Commons as fallback

- **Status:** Accepted (2026-10-16). Replaces the planned Pexels integration (Pexels is not issuing API keys to new accounts); amends D42 (images) and D44 (PPTX notes).
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

### D60. Reading order: title first

- **Status:** Accepted (2026-10-16); extended by D64 (the guard missed content placed without coordinates). Amends D41 (AI placement).
- **Problem (from use):** generated slides sometimes had a list above the title. Slots are ordered (title band on top), but when the model gave explicit coordinates that didn't collide with anything, `placeElement` kept them as they were, above the title included; and the prompts never stated a reading order.
- **Prompt (all phases):** the shared instructions now set the default reading order, "unless the user explicitly asks for a different arrangement": title topmost; then subtitle or lead line; then the main content (bullets, chart, table, image); then supporting text (takeaways, captions, sources); nothing above the title or between title and subtitle; side-by-side content starts level below the title; elements added in that same order so they appear top to bottom. The populate prompt adds: add in reading order and omit coordinates (slots). Prompt version `2026-10-16.2`.
- **Guard (generation only):** `placeElement(..., { belowTitle: true })`, set by the tools in `/api/populate` (`createDeckTools(ctx, { phase: 'populate' })`). An AI box (not the title) that starts above the title's bottom moves to just below it (title bottom + 24) at the same x and size; if that runs off the slide, the nearest free spot below the title; failing that, it shrinks to the space between the title and the bottom margin. Edits don't set it: there the user may ask for something above the title, and the prompt rule covers the default.
- **Consequences:** 3 tests (moved below the title with size kept, too-tall box shrinks instead of covering the title, title itself and title-less slides untouched; without the option an explicit box stays put); 192 tests. Not yet checked against a live model run.

### D61. Drops shrink to fit; README and architecture for review

- **Status:** Accepted (2026-10-16); the "lands on top" fallback is replaced by making room in D63. Amends D31 (placement) and D7 (thumbnail drops).
- **Problem (found while recording the README's GIF):** a chart dropped on a thumbnail landed on top of the target slide's content whenever there was no free spot at full size. `findFreeSpot` (thumbnail drops, paste, the AI's `move_element` to another slide) never tried a smaller size, while AI placement already shrank to 75% and 50% first (D31).
- **Decision:** `findFreeSpot` tries `FIT_SCALES` = 100%, 75%, 50%, 35% of the size, keeping proportions, and only then falls back to full size on top of the content, clamped (the brief: "clamp position/size into the artboard rather than fail"). Charts redraw at any size and text auto-shrinks, so a smaller copy stays readable.
- **Docs for review:** README rewritten (reviewer quick path with exact clicks for the brief's seven steps, setup and env, architecture overview with the schema → store → canvas / filmstrip / chat tools → export flow, drag-and-drop and cross-slide moves, the agent with tools and Sarvam results, the design system, honest known gaps); `docs/media/cross-slide-drag.gif` (a real mouse drag of the sample chart from slide 3 onto slide 4's thumbnail, recorded from a local build); `docs/ARCHITECTURE.md` gains drag-and-drop, generation, images, export, persistence and routing sections with diagrams; `docs/TRADEOFFS.md` notes that Present transitions were added (D48).
- **Consequences:** 1 test (shrinks with proportions kept and no overlap; a slide with no room at any size still gets the drop at full size); 193 tests. Sample deck: slide 4 and slide 1 have room for the 1100 × 740 chart (at 50% / 35%); slides 2, 3, 5 and 6 are full, so a drop there lands on top (listed in the README's known gaps).

### D62. Toasts and modals instead of browser dialogs

- **Status:** Accepted (2026-10-16). Requested by Rohan: toasts for deletions, and modal confirmations instead of alerts wherever the user is asked something. Replaces `OpErrorToast` (D33).
- **Decision:**
  - **Toasts** (`features/feedback/Toaster.jsx`, Radix Toast): `success | error | info`, title, optional description and one action; at most three, bottom centre; paused while hovered or focused, swipe or Esc to dismiss, announced to screen readers. Errors and toasts with an action stay 6 s, others 3.5 s. Rejected edits (`lastError`, e.g. a locked element) show as error toasts in plain words.
  - **One modal** (`features/feedback/AppDialog.jsx` on a new `primitives/ui/alert-dialog.jsx`, Radix AlertDialog): `confirm` (resolves true/false) or `prompt` (one text field with validation; resolves the text or null). Focus is trapped and returned; Esc and Cancel resolve "no". Opened from any component with `useFeedback()` (`toast`, `error`, `confirm`, `prompt`); state in the UI slice (`toasts`, `dialog`).
  - **Where:** deleting elements (Delete key, toolbar) and slides shows "Deleted chart" / "Deleted slide "Title"" with **Undo**. Undo reverts only while that deletion is still the newest history entry; otherwise the toast says to use Ctrl+Z, so it never undoes something newer. Cut stays quiet. Deleting a saved presentation (not in the undo history) asks first in a destructive modal, then confirms with a toast. "Image from a URL…" is a modal with a link check (opened a tick after the menu closes, so focus stays in the dialog). Export results ("PowerPoint file downloaded", placeholders note, failure), image insert/replace failures and deck-file import errors are toasts. No `window.alert`, `confirm` or `prompt` remain.
- **Rejected:** `sonner` (another dependency; Radix Toast is already in `radix-ui`); confirming every deletion with a modal (deletions in the deck are undoable, so Undo is faster than asking).
- **Consequences:** Browser check: Delete → "Deleted chart · Undo" → Undo restores it; delete a slide, nudge something, then Undo in the toast → "Can't undo from here", the slide stays deleted; deleting a locked element → error toast; image URL modal rejects "not a url", Esc closes; project delete modal: Cancel keeps it, Delete removes it and toasts; no native dialogs, no page errors.

### D63. A full slide makes room instead of being covered

- **Status:** Accepted (2026-10-16). Amends D61 (its last fallback) and D54 (group thumbnail drops). Requested by Rohan: "can't we check overlapping and fix this issue?"
- **Decision:** `fitOnSlide(slide, boxes)` (`lib/layout/room.js`) places one element or a group (arrangement kept, scaled together) for a thumbnail drop and for the AI's `move_element` to another slide:
  1. a free spot near the old position at 100 / 75 / 50 / 35% (D61);
  2. else **make room** (`makeRoom`): the content area below the title is split into halves (right, left, bottom, top; nearest the old position first). The newcomer is fitted into a half at its proportions (at least 35%), and every element it would overlap gives way along that half's axis: narrowed (left/right) or shortened (top/bottom) so it ends where the newcomer begins, with a 24-unit gap. Text and tables shrink their text to fit, charts redraw, images re-crop. Never trimmed: the title, locked elements, elements lying entirely inside the half, or anything that would fall below a minimum size (text 240 × 80, chart 360 × 240, table 360 wide and 44 per row, image 200 × 140). The half that takes least area from existing content wins;
  3. only if no half works (e.g. the element in the way is locked): on top, clamped, so the drop still never fails.
  - The move and the trims are one dispatch: one undo step restores everything. The AI's tool emits the same ops (`move_element` + `update_element` bbox).
  - Replaces `groupToFreeSpot`, which after D61 could shift a group into a shrunk spot without scaling its members.
- **Consequences:** 4 tests (trims the element in the way and keeps the title and proportions; a locked element is never trimmed and the drop lands on top; a group scales and keeps its arrangement; the AI's `move_element` emits the trims and leaves no overlap); 197 tests. Sample deck, the 1100 × 740 chart onto each slide: slides 1 and 4 free spots; slide 2 the full-width bullets narrow to the right half; slides 3, 5 and 6 the side-by-side pair shortens and the chart takes the top half; no overlap anywhere. Browser check: drop onto slide 2's thumbnail → chart and narrowed text side by side, Ctrl+Z restores both.

### D64. No content above the title; cover slides stay covers

- **Status:** Accepted (2026-10-16). Extends D60.
- **Problem (from use, after D60):** generated slides 1 and 2 still had bullets above the title. They had the `title` and `section` layouts, whose only slots are title and subtitle. The model added a subtitle and then bullets; with no slot left, the bullets went to the first free spot, top-left, because the free-spot search on these layouts starts at the top (`NO_TITLE_BAND`). D60's guard only covered boxes the model gave coordinates for. The planner had also given these slides key points, which the populate request listed as content.
- **Decision:**
  - **Placement:** content that `placeElement` places itself (no slot free, or colliding AI coordinates) never starts above the title's bottom + 24, on every layout and in every phase (`floorFor` = max(layout content top, `titleFloor`)).
  - **Generation:** in `/api/populate`, body text, charts, tables and images on a cover-style layout are handled before placing: on the deck's first slide (the cover) the tool refuses with an error telling the model to put the points in the speaker notes; on any later `title` / `section` slide it first switches the slide to the `content` layout (`change_layout` with `reflowLayout`: title to the title bar, subtitle to the lead line) and then places the content below the title.
  - **Prompts:** plan: the cover is "title and one subtitle line"; `section` only for dividers in decks of 8+ slides; a slide with points, data or an image needs a content layout. Populate: the cover gets nothing but a subtitle; for title/section slides the key points are labelled "for the one-line subtitle and the speaker notes only". Prompt version `2026-10-16.3`.
- **Consequences:** 3 tests (cover refuses bullets and emits nothing; a later section slide switches to content with the body below the title; outside generation, auto-placed content on a title slide still lands below the title); the flow test's mock model adds a subtitle to the cover, as the prompt asks; 200 tests.

### D65. Planning view

- **Status:** Accepted (2026-10-16). Replaces the dashed ghost frames shown while the outline is planned. From use: "it looks very plain compared to the other pages".
- **Decision:** `features/canvas/PlanningPlaceholder.jsx`. A status card at slide width: the AI's sparkle in a saffron circle with a soft ping, "Planning your deck" in the display serif, the user's prompt, the three real stages (Outline active, then Fill each slide, Ready to edit), and one line on what happens next (titled slides first, then each fills in; Stop keeps what landed). Below it, three skeleton slides drawn in the deck's own theme colours (background, text, muted, accent roles) and shaped like what is coming: a cover, a slide of points, a chart slide. Blocks are positioned in percentages of the artboard, so they scale like slides. The filmstrip shows the same skeletons at thumbnail size and "Planning…" instead of "0 slides". A slow saffron sheen crosses each skeleton, staggered per slide, timed by the motion tokens (`--motion-highlight-ai`, `--motion-base`) and stopped for reduced motion.
- **Consequences:** Browser check in light and dark: status card, prompt, steps, themed skeletons and filmstrip skeletons with `/api/plan` held open; no page errors; motion-token test passes.

### D66. The modal closes through Radix, never by unmounting

- **Status:** Accepted (2026-10-16). Amends D62.
- **Problem (from use):** after "Delete presentation", the page stayed blocked until a reload: `<body>` kept `data-scroll-locked` and `pointer-events: none`, with Radix focus guards in the DOM. `AppDialog` rendered the Radix root only while a request was open and removed it on the answer, so the root was unmounted while still `open`. That skips Radix's close sequence (focus return, scroll-lock and pointer-events release), a known way to leave the body locked. Our scripted runs (production build and the dev server, light and dark, reduced motion, deleting the last project) didn't reproduce it, but the code path was fragile either way.
- **Decision:**
  - The AlertDialog root stays mounted; `open` follows the store's `dialog`, so every answer closes it through Radix, and the last request's content stays rendered while it animates out.
  - Clicking the dimmed backdrop cancels (AlertDialog ignores outside clicks on its own), as do Esc and Cancel, so a dialog can never feel like a trap.
  - Safety net: once the dialog has closed and its exit animation is over (`--motion-emphasis` + 50 ms), if no dialog or menu is open, any leftover `pointer-events: none` or `data-scroll-locked` on `<body>` is removed.
- **Consequences:** Browser check on the production build and the dev server (StrictMode): Cancel, Esc, backdrop click, Delete three times down to no projects, then the image-URL prompt closed with Esc; after each, the body has no lock, no focus guards remain and the page stays clickable; no page errors.

### D67. Present mode survives StrictMode: fullscreen ends on the route change

- **Status:** Accepted (2026-10-16). Amends D59 (`PresentRoute`).
- **Problem (from use):** in `npm run dev`, Present ended right after it started; it took several clicks to get in. `PresentRoute` cleared the store mirror and called `document.exitFullscreen()` in a layout-effect cleanup. React's StrictMode (dev only) runs every effect's cleanup once right after mounting, so entering Present immediately left fullscreen, and Present mode treats leaving fullscreen (the browser's own Esc) as "exit the presentation". Whether the async fullscreen request won the race decided if a click "worked". The production build has no StrictMode, which is why only development showed it. A scripted run reproduced it: 0 of 6 starts stayed on the dev server, 6 of 6 on the build.
- **Decision:** `PresentRoute`'s effect only mirrors the slide into the store (set on mount and on slide change, cleared on cleanup; StrictMode's extra run is harmless there). Fullscreen ends in `DeckRoute`, which stays mounted: `useExitFullscreenWhenPresentEnds` watches `useMatch('/deck/:deckId/present/:slide')` and leaves fullscreen when the URL goes from a Present URL to one that isn't (Esc, the X, the last slide, Back).
- **Consequences:** Browser check on the dev server and the build: 6 of 6 starts from the Present button stay, F5 stays; → moves to slide 2; Esc, Back and → on the last slide each return to `/deck/:id` with fullscreen off; leaving the browser's fullscreen ends Present; the D59 routing check passes; 200 tests.

### D68. Audit against the brief's AI requirements

- **Status:** Accepted (2026-10-16). Checked against the code, not the docs.
- **Tool calling:** 21 tools at slide and element granularity (`add_slide`, `update_slide`, `delete_slide`, `duplicate_slide`, `reorder_slides`, `change_layout`, `add_text`, `add_chart`, `add_table`, `add_image`, `add_shape`, `update_element(s)`, `delete_element`, `move_element`, `resize_element`, `reorder_elements`, `update_chart_data`, `change_chart_type`, `get_slide`, `finish_turn`, plus `plan_deck` for generation). No endpoint asks for deck content as text: plan forces the `plan_deck` tool (an outline only); populate and edits require a tool call on the first step and leave the choice of tool to the model; populate gets a reduced set (adds, notes, finish). All three providers (sarvam-105b, Gemini, gpt-oss-120b) support tool calling; Sarvam's was verified by `llm:smoke` / `llm:probe` (D36–D38).
- **Schema as the contract:** the deck, slide and element schema is Zod (`lib/schema`): element id, type, bbox, rotation, lock, group and typed payloads (paragraphs, chart spec, table rows, image src/crop). The model calls tools with flat, typed inputs (Zod → JSON Schema, checked portable by a test); each tool resolves them into ops, and every op and every resulting element is validated with `OpSchema` / `ElementSchema` by the same `applyOp` on the server and in the browser. The model can give a box (`x, y, w, h`) and sees every box in its context; when it omits one, the layout places the element.
- **Context:** rebuilt from the browser's store on every request: slide order and ids, titles, layouts, every element's id, type, box, slot, lock and group, a text preview, chart kind / categories / series, table size and header, image descriptions, the current slide and the selection. Long text and series are clipped (80 / 160 chars) and table cells beyond the header are left out; `get_slide` returns the full content on demand. New: a flow test drags the chart from slide 3 to slide 5 in the store, runs a chat edit through the real `/api/agent`, and checks the model's prompt lists the chart (with its new box) under slide 5 and not slide 3, and that the model's `change_chart_type` lands on the chart on slide 5.
- **Keys:** read only from `process.env` in `api/` (and `scripts/`); nothing in `src` reads env or uses a `VITE_` prefix, and the production bundle contains no key names; `.env` and `.env*.local` are git-ignored; `.env.example` and the README document the variables. `/api` has a body-size limit and a per-IP rate limit (in memory, best-effort on serverless).
- **Open points (not failures):** "patch, not regenerate" in edits rests on the granular tool set (there is no regenerate tool) and the prompt; nothing in code stops a model that deletes and re-adds everything. The `/api` endpoints are public, so the rate limit is the only guard on key spend. Whether a `.env` was ever committed can only be checked in the repository's history.
- **Consequences:** 201 tests.
