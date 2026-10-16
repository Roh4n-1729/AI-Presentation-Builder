# CLAUDE.md — working notes for AI coding sessions

AI Presentation Builder (take-home, 2-day hard deadline). Full rationale: `docs/DECISIONS.md` (D1–D71), rejected options: `docs/TRADEOFFS.md` (do not implement anything from it unless asked).

## Stack

Vite 8 + React 19 (JavaScript + JSDoc, no TS) · Vercel functions in `/api` · AI SDK v7 (`ai@7`) with `sarvam-ai-sdk` (primary `sarvam-105b`), `@ai-sdk/google`, `@ai-sdk/groq` fallbacks · Zod · React Router 8 · Zustand (vanilla) + Immer patches · react-moveable · @dnd-kit/sortable · Recharts 3 · Tailwind v4 + shadcn/ui (JS) + lucide-react · pptxgenjs · idb-keyval · Vitest.

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
- Keys only in env vars. Never send image data with chat requests: the only image bytes that leave the browser are one ≤768 px JPEG per picture to `/api/describe` (D58); the AI sees that description as text.
- Conventional Commits. Explain non-obvious code briefly; prefer simple over clever.

## Canvas gotchas (from the spike — keep these fixes)

1. Write to the store only on pointer release; Escape restores inline styles and writes nothing.
2. Click-and-drag an unselected element: stash the pointerdown event, call `dragStart` one frame after Moveable mounts, only if the pointer is still down.
3. Drag-cancel Escape listener: capture phase + `stopImmediatePropagation`.
4. Deselect only on the slide background itself (`e.target === frame || .artboard`).
5. Pressing an already-selected element (no Shift) keeps the group.
6. Text edit = uncontrolled contentEditable; `select()` must not clear `editingId` (blur commits).
7. `user-select: none` on the artboard, opt back in on `[contenteditable=true]`.
8. Cross-slide hit-test via `document.elementsFromPoint` → `[data-slide-drop]` / `[data-slide-frame]`; frame drop converts screen rect to target units. Single and group drags share these rules; groups move as one piece (`shiftGroup`, `groupToFreeSpot`).
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
- [x] Up to 5 projects + Recent on StartScreen, "New" button, collapsible panels (Ctrl+[ / ]), dark slides `ink` + slide shadows (D40); 112 tests
- [x] Content spacing (D41): lead/heading slots, slots trimmed around existing content, AI boxes never overlap, text auto-shrink; 115 tests
- [x] Insert menu (+ image upload ≤1600 px), chart/table data editor drawer, floating toolbar (D42); 117 tests
- [x] Review fixes (D43): chart editor axes/options/grid, legend rule `legendAvailable`, one right panel (editor = chat width, follows selection, collapses), focus on open, All presentations link, primary New, rectangular chips
- [x] Export (D44): PPTX (native charts/tables, Cambria/Arial with re-measured fit, framed images), PDF print view (zoom), present mode, box select, themes Paper/Sand/Midnight (Sand → Sage in D46), deck .json export/import; `docs/THIRD_PARTY.md`; 123 tests
- [x] pptxgenjs advisory pinned via overrides; present mode hides editor handles and takes focus; F5 works mid-edit (D45)
- [x] Sage (+ dark Moss) replaces Sand, theme previews; floating toolbar clamped inside the column; resizable / widenable side panel (D46); 126 tests
- [x] Shared `MenuItem` (Insert, Export), slide-count dropdown, themed scrollbars, 176 × 99 thumbnails with the ring on the preview (D47)
- [x] Motion tokens (`--motion-*`, Tailwind `duration-fast|base|move|emphasis`, `hooks/motion.js`, guard test), speaker notes (canvas + Present N), slide transitions (none/fade/push), AI changes glide/fade on the canvas, animated panels (D48); 131 tests
- [x] URL routing `/`, `/deck/:id`, `/deck/:id/present/:n` (Back/Forward, deep links, Vercel rewrite); canvas `isolate` under menus; resize cursor token; notes/composer spacing (D49); 133 tests
- [x] Top bar: three zones (title · canvas tools centred · output + settings), `BrandMark`, serif title, save icon; dark resize arrow; rename spacing (D50)
- [x] Charts: axis headroom + round ends, empty series hidden, one tick format per axis, export uses the same range; AI tools drop empty series, kind by data (D51); 137 tests
- [x] Persistence behind `kvStore.js` (idb-keyval in the browser, Map in tests); `fake-indexeddb` removed (D52); 140 tests
- [x] Copy/cut/paste (elements, images, cells, text), groups (Ctrl+G), spreadsheet paste into chart/table, image crop, Insert → Title, Tidy chip (removed in D56); clicking a slide makes it current (D53); 161 tests
- [x] Groups / multi-selections drag to other slides (frame or thumbnail, arrangement kept, Alt copies) (D54); 163 tests
- [x] Table rows take their text height, box grows for added rows, text shrinks to fit; Next on the last slide ends Present (D55); 164 tests
- [x] Tidy removed; click inside an ungrouped multi-selection selects just that element; tables fill their box, start at one row height per row, min 44 units a row (D56); 164 tests
- [x] Deployed with keys: https://ai-presentation-builder-eosin.vercel.app/ (working, per Rohan)
- [ ] Reviewer script (the brief's 7 steps) on the live URL
- [x] README (reviewer quick path + GIF, setup, architecture, DnD, agent + Sarvam results, design system, known gaps); ARCHITECTURE.md sections; drops shrink 75/50/35% before overlapping (D61); 193 tests
- [x] Stock photos for AI images: Openverse → Wikimedia Commons → placeholder, keyless, CC0/PD/CC BY, credits in toolbar + PPTX notes, long queries shortened, `[photos]` console log (D57); 180 tests
- [x] Image descriptions: each picture described once by Gemini (`/api/describe`), stored with a src fingerprint, sent as text; `dispatch(..., { record: false })` (D58); 188 tests
- [x] React Router 8 owns navigation; `services/router.js` removed; workspace start functions return the deck id; generate keeps the project id (D59); 189 tests
- [x] Reading order: prompt rule (title → subtitle → main → supporting) + generation guard `placeElement(..., { belowTitle })` (D60); 192 tests
- [x] Toasts (Undo on deletions) + in-app confirm/prompt modal replace window.alert/confirm/prompt (D62); full slides make room on drops / AI moves (`fitOnSlide`, D63); 197 tests
- [x] No content above the title on any layout; cover refuses content while generating, later title/section slides switch to content (D64); planning view with themed skeletons (D65); 200 tests
- [x] Start page centred when there are no saved presentations (D69)
- [x] Follow-up chips after generation come from `plan_deck` `suggestions`; Generate button restyled (D70); 202 tests
- [x] Light/dark toggle on the start page (`ColorSchemeToggle`, D71)
- [ ] Check stock photos on the live URL (CORS of image hosts, real limits)

## Where things are

- Store: `src/store` (`appStore`, `createAppStore`, `actions.js`); components read it via `src/hooks/useDeck.js` (`useDeck`, `getDeckState`, `useDeckActions`)
- Renderer: `src/features/slide` (props only + `SlideInteractionContext`); canvas: `src/features/canvas`; filmstrip: `src/features/filmstrip`
- Ops: `src/lib/ops` (`applyOp`, `OpError`, `findElement`) · schemas: `src/lib/schema` · placement: `src/lib/layout` (`placeElement`, `reflowLayout`, `findFreeSpot`, `LAYOUT_DEFS`) · slide themes: `src/lib/theme` · factories: `src/lib/factories.js`
- UI kit: `src/primitives/ui/*` (shadcn, JS), `src/primitives/cn.js`, tokens in `src/styles/index.css` (`bg-panel`, `text-muted-foreground`, `bg-user`, `bg-ai`, `text-ui`, `text-label`, `font-display`, `shadow-float`, `ease-standard`)
- Add shadcn components on a dev machine: `npx shadcn@latest add <name>` (components.json is JS mode)

- Agent: `src/lib/agent` (tools, plan, prompts, context) · `api/_lib` (sse, guard, providers, runTurn) · client runs in `src/services/ai.js` (bound via `src/hooks/useAi.js`) · chat UI in `src/features/chat`
- Persistence: `src/services/persistence.js` (projects index + records, autosave) on `src/services/kvStore.js` (`createIdbStore`, `createMemoryStore` for tests via `setStorage`), `src/services/workspace.js` (boot, open/close/delete project, start blank/sample; transitions serialized), bound in `src/hooks/useWorkspace.js` (actions navigate), `useProjectRoute`; `ui.screen` = whether a project is loaded
- Color scheme + panels: `ui.colorScheme`, `ui.panels`; synced to `<html>` and localStorage by `useChromePrefs` (App); slides display `getTheme(id, scheme)`
- Local `/api`: `scripts/vite-local-api.js` (dev-only Vite middleware); live check of the AI path: `npm run llm:probe`
- Editing UI: insert menu `features/topbar/InsertMenu.jsx` (+ `hooks/useInsert.js`, `services/images.js`), drawer `features/drawer/*`, floating toolbar `features/canvas/FloatingToolbar.jsx`; actions `insertElement`, `patchElement`, `reorderElement`
- Select store values, not fresh objects: `useDeck((s) => findElement(...)?.el)`, never `useDeck((s) => findElement(...))` (new object every call = infinite re-render)
- Tests that span client and server: `tests/flow.test.js` (stubbed fetch → real handlers → mock model)

- Export: `src/lib/export/pptx.js` (pure model + writer), `src/services/pptxExport.js` (fit, images, download, deck json), `features/present/{PrintView,PresentMode}.jsx`, `features/topbar/{ExportMenu,ThemeMenu}.jsx`; box select `features/canvas/useMarquee.js`
- Motion: never a raw duration/easing. Tailwind `duration-fast|base|move|emphasis` + `ease-standard|enter|exit`, CSS `var(--motion-*)`, JS `motion()` from `hooks/motion.js`; `tests/motion-tokens.test.js` enforces it
- AI change animation: `features/canvas/useAiMotion.js`; speaker notes: `features/canvas/SlideNotes.jsx`; Present split button: `features/topbar/PresentButton.jsx`; panels: `features/sidepanel/PanelSlot.jsx`
- Routing (D59): React Router, routes in `src/router.jsx`, route components in `src/screens/routes.jsx` (`StartRoute`, `DeckRoute`, `PresentRoute`), paths from `lib/routes.js` (`deckPath`, `presentPath`). The URL decides the screen: navigate with `useNavigate` / `<Link>` (or `useWorkspace`, `usePresentNavigation`), never `history.*`. `ui.presenting` mirrors the present route for non-component code; don't set it directly. Never put one-off side effects (fullscreen, navigation) in effect cleanups: StrictMode runs them right after mount (D67)
- Clipboard: `lib/clipboard.js` (payload, paste ops) + `hooks/useClipboard.js` (copy/cut/paste events); groups `lib/groups.js` (selection always completes groups); grids `lib/tabular.js`; crop `lib/crop.js` + `features/drawer/ImageCropEditor.jsx`
- Image descriptions: `lib/imageInfo.js` (`srcFingerprint`, `currentDescription`) + `services/captions.js` (`startCaptioner`) + `api/describe.js` (`visionModel()` in `api/_lib/providers.js`)
- Stock photos: `lib/photos.js` (URLs, parsing, licence filter, pick, budget) + `services/photos.js` (`searchPhoto`, `loadPhoto`, `startPhotoFiller`, started in `bootWorkspace`)
- Feedback (D62): `useFeedback()` → `toast`, `error`, `confirm`, `prompt` (UI slice `toasts`, `dialog`; `features/feedback/{Toaster,AppDialog}.jsx`). Never `window.alert/confirm/prompt`. Keep Radix modal roots mounted and close them via `open` (D66)
- Placement without a drop point: `fitOnSlide` (`lib/layout/room.js`: free spot → shrink → make room → on top) (D63)
- Menus: one row component `primitives/MenuItem.jsx` (icon, label, `Kbd` shortcut); never a native `<select>`
- Right panel shell: `features/sidepanel/SidePanel.jsx` (`SidePanel`, `ExpandPanelButton`; width `ui.sideWidth`, limits `SIDE_WIDTH` in `lib/constants.js`)
- Print uses CSS `zoom`, never a transform (Chromium PDF drops SVG charts in scaled transforms)

## Open items (proposed, not yet decided)

None.
