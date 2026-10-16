import { Sparkles } from 'lucide-react';
import { useDeck } from '@/hooks/useDeck.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { resolveColor } from '@/lib/theme/index.js';
import { cn } from '@/primitives/cn.js';

/*
 * What the canvas shows while the AI plans a new deck, before any slide exists (D65): the prompt
 * and where the run is (outline → slides → ready), then skeleton slides drawn in the deck's own
 * theme, shaped like what is coming (a cover, a slide of points, a chart slide), with a slow
 * saffron sheen. Positions are percentages of the artboard, so the skeletons scale like slides.
 */

const STEPS = ['Outline', 'Fill each slide', 'Ready to edit'];

/** Skeleton blocks per slide shape: [left%, top%, width%, height%, role]. */
const SHAPES = [
  // cover: centred title and subtitle
  [
    [8, 34, 64, 11, 'title'],
    [8, 52, 46, 5, 'line'],
  ],
  // points: title, then bullets
  [
    [5, 8, 52, 8, 'title'],
    [5, 28, 2, 3, 'dot'],
    [9, 28, 70, 3.4, 'line'],
    [5, 38, 2, 3, 'dot'],
    [9, 38, 62, 3.4, 'line'],
    [5, 48, 2, 3, 'dot'],
    [9, 48, 66, 3.4, 'line'],
    [5, 58, 2, 3, 'dot'],
    [9, 58, 48, 3.4, 'line'],
  ],
  // chart: title, bars on the left, takeaways on the right
  [
    [5, 8, 46, 8, 'title'],
    [7, 66, 6, 20, 'bar'],
    [16, 54, 6, 32, 'bar'],
    [25, 44, 6, 42, 'bar'],
    [34, 34, 6, 52, 'bar'],
    [43, 26, 6, 60, 'bar'],
    [5, 87, 50, 0.6, 'axis'],
    [62, 30, 32, 3.4, 'line'],
    [62, 40, 28, 3.4, 'line'],
    [62, 50, 30, 3.4, 'line'],
  ],
];

/** One skeleton slide (or thumbnail) in the deck's theme. */
export function SkeletonSlide({ shape, theme, width, height, delay = 0, className }) {
  const fill = {
    title: resolveColor('text', theme),
    line: resolveColor('muted', theme),
    dot: resolveColor('accent', theme),
    bar: resolveColor('accent', theme),
    axis: resolveColor('border', theme),
  };
  return (
    <div
      aria-hidden
      className={cn('plan-skeleton relative overflow-hidden rounded-md', className)}
      style={{ width, height, background: resolveColor('bg', theme), '--plan-delay': `${delay}` }}
    >
      {SHAPES[shape].map(([l, t, w, h, role], i) => (
        <div
          key={i}
          className="absolute rounded-[3px]"
          style={{
            left: `${l}%`,
            top: `${t}%`,
            width: `${w}%`,
            height: `${h}%`,
            background: fill[role],
            opacity: role === 'title' ? 0.16 : role === 'bar' ? 0.22 : 0.12,
          }}
        />
      ))}
    </div>
  );
}

export function PlanningPlaceholder({ scale, theme }) {
  const prompt = useDeck((s) => s.messages.findLast?.((m) => m.role === 'user')?.text ?? '');
  const w = ARTBOARD_W * scale;
  const h = ARTBOARD_H * scale;
  return (
    <div className="flex flex-col items-center gap-10" aria-live="polite" aria-busy="true">
      <section
        className="flex w-full animate-in flex-col gap-4 rounded-xl border bg-panel px-6 py-5 shadow-float duration-move ease-enter fade-in-0 slide-in-from-bottom-2"
        style={{ maxWidth: w }}
      >
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai">
            <span className="absolute inset-0 animate-ping rounded-full bg-ai/20" />
            <Sparkles className="relative size-[18px]" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[26px] leading-tight">Planning your deck</h2>
            {prompt && (
              <p className="mt-1 line-clamp-2 text-ui text-muted-foreground">“{prompt}”</p>
            )}
          </div>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-label">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                i === 0 ? 'border-ai/40 bg-ai-soft text-foreground' : 'text-faint',
              )}
            >
              {i === 0 ? (
                <span className="size-1.5 animate-pulse rounded-full bg-ai" />
              ) : (
                <span className="text-faint tabular-nums">{i + 1}</span>
              )}
              {label}
            </li>
          ))}
        </ol>
        <p className="text-label text-faint">
          The outline appears first as titled slides, then each slide fills in. You can stop at any
          time and keep what has landed.
        </p>
      </section>
      {[0, 1, 2].map((i) => (
        <SkeletonSlide
          key={i}
          shape={i}
          theme={theme}
          width={w}
          height={h}
          delay={i}
          className="animate-in shadow-[var(--slide-shadow)] duration-emphasis ease-enter fade-in-0 slide-in-from-bottom-4"
        />
      ))}
    </div>
  );
}
