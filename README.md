# AI Presentation Builder

A web-based AI presentation builder: describe a deck, the AI plans and fills it slide by slide through tool calls, then you refine it in chat or directly on a free-form canvas (drag, resize, snap, drag elements across slides, charts with editable data, undo, export).

> **Status:** Day 1 of 2 — scaffold. Sections marked _TBD_ are filled in as features land.

- **Live:** _TBD_
- **Design records:** [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/TRADEOFFS.md](docs/TRADEOFFS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) (licenses)

## Reviewer quick path

_TBD: the brief's seven review steps mapped to exact clicks, plus a GIF of the cross-slide drag._

## Setup

Requirements: Node 24, npm 11. The [Vercel CLI](https://vercel.com/docs/cli) is optional (deploys, or `vercel dev` for an exact production runtime).

```powershell
npm install
Copy-Item .env.example .env   # then fill in the keys
npm run dev        # UI + /api functions (keys from .env)
```

| Script                            | What it does                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server with the `/api` functions served in-process (keys read from `.env`)                                                                                   |
| `npm run dev:full`                | `vercel dev` (needs the Vercel CLI and a linked project): the exact production runtime                                                                                |
| `npm run build`                   | Production build into `dist/`                                                                                                                                         |
| `npm run lint`                    | ESLint, including the layer-import rules                                                                                                                              |
| `npm run format` / `format:check` | Prettier                                                                                                                                                              |
| `npm test`                        | Vitest unit tests                                                                                                                                                     |
| `npm run llm:smoke`               | Checks each provider key: a forced `plan_deck` call and a streamed tool loop (add `-- sarvam`, `-- gemini` or `-- groq` for one; spends a few Sarvam credits)         |
| `npm run llm:probe`               | Runs the app's real AI path per provider: plan a 4-slide deck, populate two slides, one edit; prints events, timings and op counts (add `-- sarvam` for one provider) |

### Environment variables

See [`.env.example`](.env.example). Keys are read only by the serverless functions and never shipped to the browser.

| Name                                         | Purpose                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`, `LLM_FALLBACKS`              | Provider chain (default `sarvam`, then `gemini,groq`)                                           |
| `SARVAM_API_KEY`                             | Sarvam (`sarvam-105b`), primary model                                                           |
| `GOOGLE_GENERATIVE_AI_API_KEY`               | Gemini fallback                                                                                 |
| `GROQ_API_KEY`                               | Groq fallback                                                                                   |
| `SARVAM_MODEL`, `GEMINI_MODEL`, `GROQ_MODEL` | Optional model id overrides (defaults `sarvam-105b`, `gemini-3.8-flash`, `openai/gpt-oss-120b`) |
| `PEXELS_API_KEY`                             | Optional stock photos for AI-placed images                                                      |

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
