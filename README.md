# AI Presentation Builder

A web-based AI presentation builder: describe a deck, the AI plans and fills it slide by slide through tool calls, then you refine it in chat or directly on a free-form canvas (drag, resize, snap, drag elements across slides, charts with editable data, undo, export).

> **Status:** Day 1 of 2 — scaffold. Sections marked _TBD_ are filled in as features land.

- **Live:** _TBD_
- **Design records:** [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/TRADEOFFS.md](docs/TRADEOFFS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Reviewer quick path

_TBD: the brief's seven review steps mapped to exact clicks, plus a GIF of the cross-slide drag._

## Setup

Requirements: Node 24, npm 11, [Vercel CLI](https://vercel.com/docs/cli) (for running `/api` locally).

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in the keys
npm run dev        # UI only (Vite)
npm run dev:full   # UI + /api functions (vercel dev)
```

| Script                            | What it does                                             |
| --------------------------------- | -------------------------------------------------------- |
| `npm run dev`                     | Vite dev server (UI only; `/api` calls fail)             |
| `npm run dev:full`                | `vercel dev`: UI plus the serverless functions in `/api` |
| `npm run build`                   | Production build into `dist/`                            |
| `npm run lint`                    | ESLint, including the layer-import rules                 |
| `npm run format` / `format:check` | Prettier                                                 |
| `npm test`                        | Vitest unit tests                                        |

### Environment variables

See [`.env.example`](.env.example). Keys are read only by the serverless functions and never shipped to the browser.

| Name                            | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `LLM_PROVIDER`, `LLM_FALLBACKS` | Provider chain (default `sarvam`, then `gemini,groq`) |
| `SARVAM_API_KEY`                | Sarvam (`sarvam-105b`), primary model                 |
| `GOOGLE_GENERATIVE_AI_API_KEY`  | Gemini fallback                                       |
| `GROQ_API_KEY`                  | Groq fallback                                         |
| `PEXELS_API_KEY`                | Optional stock photos for AI-placed images            |

## Architecture overview

_TBD: schema → store → canvas / filmstrip / chat tools → export. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)._

## Drag-and-drop and cross-slide moves

_TBD: library, coordinate space, what happens on drop._

## AI agent

_TBD: tools, two-phase generation, patch-only edits, context, provider chain and Sarvam test results._

## Known issues and gaps

_TBD._

## Credits

- [Presenton](https://github.com/presenton/presenton) (Apache-2.0): studied for ideas only; no code copied. See [docs/TRADEOFFS.md](docs/TRADEOFFS.md#references).
