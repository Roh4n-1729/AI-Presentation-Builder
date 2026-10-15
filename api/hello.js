import { ARTBOARD_H, ARTBOARD_W } from '../src/lib/constants.js';

// Deploy check: proves an /api function runs and can import shared code from src/lib.
export function GET() {
  return Response.json({
    ok: true,
    artboard: `${ARTBOARD_W}x${ARTBOARD_H}`,
    node: process.version,
    region: process.env.VERCEL_REGION ?? 'local',
  });
}
