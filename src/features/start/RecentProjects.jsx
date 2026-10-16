import { Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useDeck } from '@/hooks/useDeck.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { deckPath } from '@/lib/routes.js';
import { getTheme } from '@/lib/theme/index.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';

const CARD_W = 208;
const SCALE = CARD_W / ARTBOARD_W;
const MAX_PROJECTS = 5; // mirrors services/persistence.js (features can't import services)

const timeAgo = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** First slide of a saved deck, drawn by the same renderer as the editor (read-only). */
function Cover({ slide, theme }) {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-md bg-panel shadow-[var(--slide-edge)]"
      style={{ width: CARD_W, height: ARTBOARD_H * SCALE }}
    >
      {slide && (
        <div
          className="artboard-scaler pointer-events-none"
          style={{ transform: `scale(${SCALE})` }}
        >
          <SlideRenderer slide={slide} theme={theme} />
        </div>
      )}
    </div>
  );
}

/** The StartScreen's "Recent" row: up to 5 presentations saved in this browser. */
export function RecentProjects() {
  const projects = useDeck((s) => s.recentProjects);
  const scheme = useDeck((s) => s.colorScheme);
  const { deleteProject } = useWorkspace();
  if (!projects.length) return null;

  return (
    <section className="mt-14 w-full max-w-[1240px]" aria-label="Recent presentations">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-sm font-medium">Recent</h2>
        <p className="text-label text-muted-foreground">
          Saved in this browser. The {MAX_PROJECTS} most recent are kept.
        </p>
      </div>
      <ul className="flex flex-wrap gap-4">
        {projects.map((p) => (
          <li key={p.id} className="group relative">
            {/* A real link (D49, D59): middle-click / Ctrl-click opens the deck in a new tab. */}
            <Link
              to={deckPath(p.id)}
              aria-label={`Open ${p.title}`}
              className="block rounded-lg p-1.5 text-left transition-colors duration-fast hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Cover slide={p.cover} theme={getTheme(p.theme, scheme)} />
              <p className="mt-2 w-[208px] truncate text-ui font-medium">{p.title}</p>
              <p className="text-label text-muted-foreground">
                {p.slideCount} slide{p.slideCount === 1 ? '' : 's'} · {timeAgo(p.updatedAt)}
              </p>
            </Link>
            <IconButtonTip
              icon={Trash2}
              label="Delete presentation"
              className="absolute top-3 right-3 bg-panel/90 opacity-0 shadow-float group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => {
                if (window.confirm(`Delete "${p.title}"? This can't be undone.`))
                  deleteProject(p.id);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
