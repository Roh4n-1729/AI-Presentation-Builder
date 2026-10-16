import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * D48: durations and easings are defined once, as motion tokens in src/styles/index.css, and
 * used from there (Tailwind duration-fast/base/move/emphasis + ease-*, CSS var(--motion-*), JS
 * hooks/motion.js). This fails on a raw value anywhere else, so new code can't drift.
 */
const ROOT = join(import.meta.dirname, '..', 'src');
const TOKEN_FILE = 'styles/index.css';

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(jsx?|css)$/.test(name) && !/\.test\.js$/.test(name) ? [path] : [];
  });
}

const RULES = [
  [/\bduration-\d+/, 'Tailwind numeric duration (use duration-fast/base/move/emphasis)'],
  [/\bduration-\[/, 'arbitrary Tailwind duration'],
  [/\bease-\[/, 'arbitrary Tailwind easing'],
  [/cubic-bezier\(/, 'raw cubic-bezier (use --motion-ease-* / ease-*)'],
  [/(?<![\w.-])\d+(?:\.\d+)?m?s\b(?![\w-])/, 'raw time value in CSS (use var(--motion-*))', 'css'],
  [
    /\b(?:duration|transitionDuration|animationDuration)\s*:\s*\d/,
    'raw duration in JS (use hooks/motion.js)',
    'js',
  ],
];

describe('motion tokens', () => {
  it('no raw durations or easings outside the token block', () => {
    const problems = [];
    for (const path of files(ROOT)) {
      const rel = relative(ROOT, path).replaceAll('\\', '/');
      const kind = rel.endsWith('.css') ? 'css' : 'js';
      if (rel === 'hooks/motion.js') continue; // the reader's no-DOM fallbacks mirror the tokens
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (rel === TOKEN_FILE && /--motion-|0\.01ms/.test(line)) return; // the tokens, reduced motion
          if (line.trim().startsWith('*') || line.trim().startsWith('//')) return; // comments
          for (const [re, why, only] of RULES) {
            if (only && only !== kind) continue;
            if (re.test(line)) problems.push(`${rel}:${i + 1} ${why}: ${line.trim()}`);
          }
        });
    }
    expect(problems).toEqual([]);
  });

  it('every transition / enter-exit animation class names a duration token', () => {
    // Without one, Tailwind falls back to its own 150 ms. Looping indicators (spin, pulse, ping)
    // keep Tailwind's built-in timing on purpose.
    const ANIMATES = /(^|\s)(transition(-[\w[\],-]+)?|[\w[\]=-]*:?animate-(in|out))(\s|$)/;
    const problems = [];
    for (const path of files(ROOT).filter((p) => /\.jsx?$/.test(p))) {
      const src = readFileSync(path, 'utf8');
      for (const [, , str] of src.matchAll(/(["'`])([^"'`\n]*?)\1/g)) {
        const looksLikeClasses = /-/.test(str) && /^[\w\s:[\]/().%=,-]+$/.test(str);
        if (looksLikeClasses && ANIMATES.test(str) && !/\bduration-/.test(str))
          problems.push(`${relative(ROOT, path)}: ${str}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
