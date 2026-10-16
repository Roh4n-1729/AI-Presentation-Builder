# Third-party assets and licenses

Everything the app ships or loads, with its license. Nothing is copied from paid or unlicensed
sources. Slide themes (Paper, Sage, Midnight and their dark display variants Ink and Moss) are our own color sets; they use only the fonts
below. No icons or templates are downloaded from the internet at runtime; images come only from the user (upload or URL) or from the stock photo search below.

## Fonts (loaded from Google Fonts)

| Font                                                                   | Used for                              | License                   |
| ---------------------------------------------------------------------- | ------------------------------------- | ------------------------- |
| [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) | Slide titles, StartScreen heading     | SIL Open Font License 1.1 |
| [Geist](https://fonts.google.com/specimen/Geist)                       | UI and slide body text                | SIL Open Font License 1.1 |
| [Geist Mono](https://fonts.google.com/specimen/Geist+Mono)             | Numbers in the data editor, shortcuts | SIL Open Font License 1.1 |

PowerPoint export names **Cambria** (titles) and **Arial** (text), fonts that ship with Microsoft
Office / Windows / macOS. The .pptx only names them; no font files are embedded or redistributed.

## Libraries shipped in the app

| Package                                  | Version                | License                                                                            |
| ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| react, react-dom                         | 19.3.1                 | MIT                                                                                |
| react-router                             | 8.4.0                  | MIT                                                                                |
| zustand                                  | 5.0.15                 | MIT                                                                                |
| immer                                    | 11.1.21                | MIT                                                                                |
| zod                                      | 4.6.7                  | MIT                                                                                |
| react-moveable                           | 0.56.0                 | MIT                                                                                |
| @dnd-kit/core, sortable, utilities       | 6.3.1 / 10.0.0 / 3.2.2 | MIT                                                                                |
| recharts                                 | 3.10.1                 | MIT                                                                                |
| pptxgenjs                                | 4.0.1                  | MIT (its `image-size` dependency pinned to 2.0.4 via `overrides`, D45)             |
| idb-keyval                               | 6.3.0                  | Apache-2.0                                                                         |
| radix-ui (via shadcn/ui components, MIT) | 1.8.1                  | MIT                                                                                |
| lucide-react (icons)                     | 1.57.0                 | ISC                                                                                |
| class-variance-authority                 | 0.7.1                  | Apache-2.0                                                                         |
| clsx                                     | 2.1.1                  | MIT                                                                                |
| tailwind-merge                           | 3.7.0                  | MIT                                                                                |
| nanoid                                   | 6.0.2                  | MIT                                                                                |
| eventsource-parser                       | 4.1.2                  | MIT                                                                                |
| ai (Vercel AI SDK)                       | 7.0.141                | Apache-2.0                                                                         |
| @ai-sdk/google, @ai-sdk/groq             | 4.0.96 / 4.0.61        | Apache-2.0                                                                         |
| sarvam-ai-sdk                            | 0.4.6                  | **Not declared** (no `license` field or LICENSE file in the npm package; see note) |

**Note on sarvam-ai-sdk:** the package published on npm declares no license. It is Sarvam's own
provider for their API and is used server-side only (in `/api`), not shipped to browsers. Worth
confirming with Sarvam before any redistribution; for this assignment it is used as their
documented integration.

## Stock photos (searched at runtime, D57)

When the AI adds an image, the browser searches Wikimedia Commons for a photo. Commons has no API keys; requests are anonymous, within its rate limits. Only images under
**CC0**, the **Public Domain Mark** or **CC BY** are used (no share-alike, non-commercial or
no-derivatives licences). Each photo keeps its credit (title, author, licence, source page): it
is shown in the image toolbar and written to the slide's speaker notes in PowerPoint export.

| Service                                                          | Used for     | Terms                                       |
| ---------------------------------------------------------------- | ------------ | ------------------------------------------- |
| [Wikimedia Commons API](https://commons.wikimedia.org/w/api.php) | Photo search | Per-file licence; credit author and licence |

## Image descriptions (D58)

Each picture in a deck (uploads, pastes, stock photos) is sent once, as a ≤ 768 px JPEG, to
Google's Gemini API through `/api/describe`, so the chat model can know what it shows. Nothing
else about the deck is sent with it except the image's alt text.

## Build and test tools (not shipped)

vite 8.3.4, @vitejs/plugin-react 6.1.2, tailwindcss + @tailwindcss/vite 4.3.3, tw-animate-css
1.4.0, eslint 10.12.0 (+ @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh,
globals), prettier 3.9.10 (+ prettier-plugin-tailwindcss), vitest 5.0.4, husky 9.1.7, lint-staged 17.6.0. All MIT unless noted.

## Chart palettes

All chart palettes were checked with the dataviz palette validator (lightness band, chroma floor,
color-vision-deficiency separation, normal-vision floor, contrast); results are in comments in
`src/lib/theme/themes.js`.
