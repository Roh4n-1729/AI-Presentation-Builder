# Tradeoffs: what we considered and didn't build

This file records options I evaluated and deliberately did **not** implement, why, and what would make me revisit each one. Decisions that *are* implemented are in `DECISIONS.md`. Each entry follows the same shape:

> **Considered** · **Chose** · **Why** · **Revisit when**

---

## 1. Platform & tooling

### Next.js + TypeScript
- **Considered:** Next.js App Router with TypeScript (the brief's preferred framework).
- **Chose:** Vite + React in JavaScript, with JSDoc types and Zod runtime validation.
- **Why:** I can own and explain every line in JS/React; adopting Next and TS under a 2-day deadline adds risk with no product benefit. Runtime safety where it matters (LLM tool arguments, every op) comes from Zod, which TypeScript wouldn't provide anyway.
- **Revisit when:** the codebase grows beyond one person or needs server components or SEO pages.

### MUI, or MUI + Tailwind together
- **Considered:** MUI (I'm fluent in it), and a hybrid with Tailwind.
- **Chose:** Tailwind v4 + shadcn/ui (Radix underneath).
- **Why:** The chosen design (light, minimal, pill buttons, outlined icons) fights Material defaults. Running two styling systems together causes reset and specificity conflicts. One system means fewer things to explain.
- **Revisit when:** never for this project.

---

## 2. Canvas & interaction

### `<canvas>` rendering (Konva / Fabric.js)
- **Considered:** a canvas-based editor, the approach Presenton uses with Konva.
- **Chose:** a DOM-based artboard of absolutely positioned elements, CSS-scaled from 1920×1080.
- **Why:** Our elements are text, charts, tables and images, which the DOM already does well. On canvas, text editing needs overlay hacks, charts must be rasterized (the brief rejects chart images), and tables become drawn rectangles. The DOM also gives accessibility and find-in-page for free.
- **Revisit when:** we need thousands of objects, freehand drawing, or pixel effects.

### Native HTML5 drag-and-drop / a fully custom pointer engine
- **Considered:** native DnD, and writing drag, resize and snapping from scratch.
- **Chose:** react-moveable for drag, resize and snap; dnd-kit for filmstrip reorder; custom hit-testing only for cross-slide drops.
- **Why:** Native DnD fights scaled coordinates and gives poor visual control (as the brief itself warns). A full custom engine costs about half a day for snapping alone. Moveable was verified in a spike with a scaled artboard.
- **Revisit when:** Moveable blocks a needed behavior. The fallback is a pure alignment-guide function (start/center/end anchors within a threshold) plus pointer events.

### Rich text editor (Tiptap / Lexical / Slate)
- **Considered:** inline mixed formatting (bold words, links) inside text boxes.
- **Chose:** paragraphs of plain text, with bullet/level flags and box-level style.
- **Why:** Simple for the LLM to write, simple to diff and patch, and maps directly to PPTX text runs. A rich-text editor adds its own document model next to ours.
- **Revisit when:** users need per-word formatting. The schema would then add `runs[]` per paragraph.

---

## 3. State & data model

### Redux Toolkit / snapshot-based undo / command pattern
- **Considered:** Redux; undo by storing full deck snapshots; hand-written inverse commands.
- **Chose:** Zustand + Immer `produceWithPatches`. History stores patches and inverse patches.
- **Why:** Patches are small, give inverses for free, and work identically for user and AI ops. Snapshots waste memory with images. Hand-written inverses are bug-prone.
- **Revisit when:** we need collaboration (see §8).

### Server/database as the source of truth
- **Considered:** AI tools editing a server-side deck, with the client re-fetching (Presenton's approach).
- **Chose:** the client store is canonical. The server uses a throwaway working copy per request only to give the model real tool results.
- **Why:** The brief: "If you have two copies of the deck, you will lose." Server-side truth plus whole-slide replacement on the client clobbers manual edits.
- **Revisit when:** multi-device sync or collaboration is required.

### Index-path element addressing
- **Considered:** addressing elements by position (`slide 2 → element 3`).
- **Chose:** short stable prefixed ids (`el_c7x2`).
- **Why:** Positions change whenever the user reorders, drags or deletes. Ids survive manual edits, so AI ops never hit the wrong element.

### Optimistic locking / version checks during an AI turn
- **Considered:** rejecting an AI turn if the deck changed since the request started.
- **Chose:** id-targeted ops. If a target no longer exists, skip that op and tell the user.
- **Why:** Most concurrent edits don't conflict (the user moves a chart while the AI rewrites a title). Rejecting the whole turn would feel broken.
- **Revisit when:** conflicts become common. Per-element version numbers would be the next step.

### Selective undo of an older AI turn
- **Considered:** "Undo this" on any past AI message.
- **Chose:** only while that turn is the latest history entry. Otherwise the user uses ⌘Z.
- **Why:** Applying old inverse patches over newer edits corrupts state. Real selective undo needs operational transform or rebasing.
- **Revisit when:** we adopt a CRDT or OT model (see §8).

---

## 4. AI architecture

### One prompt that returns the whole deck
- **Considered:** a single structured-output call producing all slides.
- **Chose:** plan (`plan_deck`), then populate per slide with element tools; edits through a patch-only tool loop.
- **Why:** The brief requires it, and it's better anyway: visible progress, per-slide retry, output-token caps respected (Sarvam caps `max_tokens` per tier), and no regenerate path that could destroy manual edits.

### Server-orchestrated generation in one request
- **Considered:** one `/api/generate` call that plans and fills every slide.
- **Chose:** the client orchestrates: `/api/plan`, then `/api/populate` per slide, 2–3 in parallel.
- **Why:** Short requests avoid serverless timeouts, a failed slide can be retried alone, and Stop keeps whatever already landed.

### Sending the full deck or chat history every turn
- **Considered:** dumping the full deck JSON and full chat history into each request.
- **Chose:** a compact deck snapshot (ids, types, boxes, truncated text, never image data), a `get_slide` tool for detail, and the last N turns plus a running summary.
- **Why:** Token cost and latency. Base64 images alone could exceed request limits.
- **Not needed:** RAG or embeddings. The deck is small and structured, so it fits in the context directly.

### AI image generation models
- **Considered:** generating images per slide with an image model.
- **Chose:** the model supplies a search query, resolved through a stock photo API, with a styled placeholder as fallback.
- **Why:** Latency, cost and inconsistent quality. Stock photos are relevant, fast and safe to embed in exports.

### Hand-written tool loop instead of the AI SDK
- **Considered:** an OpenAI-compatible client plus our own loop over tool calls.
- **Chose:** AI SDK Core for the loop, behind our own event protocol.
- **Why:** Less provider-specific code (Sarvam, Gemini and Groq quirks). Because the client only depends on our events, the loop can be swapped later without touching the UI.
- **Revisit when:** the Sarvam test shows the SDK mishandles its tool calls.

---

## 5. Streaming

### AI SDK UI (`useChat`)
- **Considered:** the SDK's React hook for chat state and streaming.
- **Chose:** our own event stream into our own store.
- **Why:** `useChat` keeps its own copy of the messages next to our persisted chat (the "two copies" problem again), and it doesn't fit the non-chat plan and populate calls.

### WebSockets
- **Considered:** a persistent two-way socket.
- **Chose:** SSE over a `fetch` POST, one stream per request.
- **Why:** Vercel serverless functions can't hold sockets, and we only need server-to-client streaming.
- **Revisit when:** real-time collaboration (see §8).

### Native `EventSource`
- **Considered:** the browser's built-in SSE client.
- **Why not:** it only supports GET with no body, and we must send the deck snapshot.

### `@microsoft/fetch-event-source`
- **Considered:** an EventSource-like API over fetch (I've used it before).
- **Chose:** plain `fetch` + `eventsource-parser` (parse-only, actively maintained, more widely used).
- **Why:** By default it retries automatically and closes/reopens the stream when the tab is hidden. Our requests start work and aren't safe to repeat: a reconnect re-runs the AI turn, which means duplicate ops and double credits. It's usable with `openWhenHidden: true` and a throwing `onerror`, but then we'd be disabling its main features.

### Resumable streams
- **Considered:** resuming an interrupted stream from the last event id.
- **Chose:** no resume. Show the error; for generation, offer "Continue" or a per-slide retry.
- **Why:** Resume needs server-side buffering of events (a store like Redis), which we don't have on serverless. Per-slide status gives most of the benefit.

### Applying ops from partial tool arguments
- **Considered:** rendering elements while the model is still streaming their arguments.
- **Chose:** apply each op when its tool call completes and validates. Only the assistant's text streams token by token.
- **Why:** Partial JSON can't be validated, and half-rendered elements would flicker or be wrong. Per-tool granularity already looks live.

---

## 6. Performance

### Virtualizing the slide column (react-window and similar)
- **Considered:** rendering only visible slides.
- **Chose:** keep every slide mounted.
- **Why:** Virtualization would break things the product depends on: dropping onto the adjacent slide, scrolling to a slide, active-slide tracking, and the print view. Decks are 5–20 slides.
- **What we do instead:**
  - each slide frame and thumbnail is memoized and reads only its own slide (Immer keeps untouched slides as the same object);
  - off-screen frames use `content-visibility: auto`, so the browser skips rendering them while they stay in the DOM for hit-testing;
  - Moveable mounts only on the slide holding the selection;
  - chart animations are off in thumbnails and print.
- **Revisit when:** profiling shows lag at about 30+ slides. Next step: render off-screen frames as same-size placeholders.

### Virtualizing the chat list (react-virtuoso)
- **Considered:** windowing the message list.
- **Chose:** a plain list.
- **Why:** A session is about 20–80 messages. Chat lag comes from three other things, which we fix directly:
  1. **Streaming re-renders the whole list.** The in-progress reply lives in its own state field, finished messages are memoized, and text deltas flush once per animation frame.
  2. **Heavy messages.** A generation reply with 40 ops collapses to "Applied 40 changes across 6 slides", expandable. Replies are short; markdown, if any, is parsed once for finished messages.
  3. **Scroll jumping.** Stick to the bottom only when the user is already near it; otherwise show a "New activity" pill.
- Plus a soft cap: render the last 50 messages with "Show earlier", and store up to about 200 per deck.
- **The UI history and the LLM context are separate budgets.** The UI can grow without affecting tokens; the model sees only recent turns plus a summary.
- **Costs of virtualizing we avoid:** rows whose height changes while streaming, scroll anchoring when older messages load, and find-in-page and screen readers losing unmounted rows.
- **Revisit when:** profiling shows lag. The swap is contained: the list sits behind one `MessageList` component (`messages`, `streaming`, `onLoadEarlier`), and react-virtuoso (`followOutput` for stick-to-bottom) would replace only that file.

### How we'd measure
- A dev-only stress mode that seeds about 1,000 chat messages and a 40-slide deck with charts.
- Profile with the React DevTools Profiler: render time per streamed token, scroll smoothness, and time to open the deck.
- Optimize only what the measurements show.

### Other write-path choices
- Drags commit once on release; text and sliders commit on blur or debounce.
- Autosave is debounced (about 500ms); history is capped at 100 entries.

---

## 7. Output & storage

### Screenshot-based export (html2canvas → images in PPTX/PDF)
- **Considered:** rasterizing slides into images.
- **Chose:** pptxgenjs with native, editable charts and tables, plus a print view for PDF.
- **Why:** Screenshots lose editability and look blurry, and the brief wants charts to stay real.

### Server-side PDF (Puppeteer / headless Chrome)
- **Considered:** rendering PDFs on the server.
- **Chose:** the browser's print-to-PDF on a print-view route, using the same renderer.
- **Why:** Headless Chrome is heavy and slow to start on serverless. The print view guarantees the PDF matches the canvas.
- **Revisit when:** we need one-click PDF downloads without the print dialog.

### localStorage / a backend database
- **Considered:** localStorage; a hosted database.
- **Chose:** IndexedDB (idb-keyval) for the deck and chat together.
- **Why:** localStorage's ~5MB limit breaks with uploaded images. A backend adds auth and hosting that the brief puts out of scope.

### PPTX import
- **Considered:** importing existing PowerPoint files.
- **Chose:** JSON import/export of our own deck format only.
- **Why:** PPTX parsing (masters, placeholders, inherited styles) is a project of its own.

---

## 8. Out of scope, with a path forward

### Real-time collaboration (Yjs / CRDT)
- **Why not:** explicitly out of scope.
- **Path:** our ops are already small, id-targeted and serializable, so they would map onto a CRDT document (e.g. Yjs maps keyed by id) or be broadcast through a sync server. Selective undo would become possible with that model.

### Authentication & multi-user
- **Why not:** explicitly out of scope; single-user, no-auth model.
- **Path:** add auth, then move persistence behind an API with per-user decks; the client store stays canonical during a session.

### Slide transitions & build animations
- **Why not:** out of scope ("an animation engine"). UI motion is limited to purposeful feedback, such as the AI-change glow and the AI move glide.

---

## References

- **Presenton** (open source, Apache-2.0): studied for ideas, no code copied. Ideas adopted: per-slot length hints in tool descriptions, lazy read tools for context management (`get_slide`), tool-status events streamed to the chat, and directive tool descriptions with preconditions. Where we deliberately differ: client store as the single source of truth, stable element ids instead of index paths, unified undo history, and cross-slide drag.
- **sarvam.ai**: visual inspiration for the design system (light-first, serif display + grotesk UI, indigo/saffron accents, pill buttons). No brand assets or fonts used.
