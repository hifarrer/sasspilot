/* Minimal console logger with consistent prefixes. Never logs the PAT. */

export const log = {
  info: (m: string) => console.log(m),
  step: (m: string) => console.log(`\n▶ ${m}`),
  ok: (m: string) => console.log(`  ✓ ${m}`),
  warn: (m: string) => console.warn(`  ! ${m}`),
  error: (m: string) => console.error(`  ✗ ${m}`),
};

/** Mask a token for display, e.g. `aisas_…a1b`. */
export function maskToken(token: string): string {
  if (!token) return "(none)";
  return token.length <= 10 ? "****" : `${token.slice(0, 6)}…${token.slice(-3)}`;
}

/** Random integer in [min, max] — for human-like delays. */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
