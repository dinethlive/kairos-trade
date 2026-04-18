// Shuffled symbol scheduler. Each pool cycle yields every symbol exactly once
// in random order; a new permutation is drawn when the cycle is exhausted.
// Avoids "next permutation starts with the same symbol we just ended on" by
// re-shuffling until the first symbol of the new cycle differs from the last
// symbol of the previous one (best-effort; skipped when pool size < 2).

export class RotationScheduler {
  private queue: string[] = [];
  private lastEmitted: string | null = null;

  constructor(private pool: string[]) {}

  setPool(pool: string[]): void {
    this.pool = [...pool];
    this.queue = [];
  }

  size(): number {
    return this.pool.length;
  }

  peek(): string | null {
    if (this.pool.length === 0) return null;
    if (this.queue.length === 0) this.refill();
    return this.queue[0] ?? null;
  }

  next(): string | null {
    if (this.pool.length === 0) return null;
    if (this.queue.length === 0) this.refill();
    const next = this.queue.shift() ?? null;
    if (next) this.lastEmitted = next;
    return next;
  }

  reset(): void {
    this.queue = [];
    this.lastEmitted = null;
  }

  private refill(): void {
    const src = [...this.pool];
    shuffle(src);
    // If pool is ≥2 and the first item repeats the last emitted one,
    // swap it out so the rotation visibly moves.
    if (src.length >= 2 && this.lastEmitted && src[0] === this.lastEmitted) {
      const tmp = src[0]!;
      src[0] = src[1]!;
      src[1] = tmp;
    }
    this.queue = src;
  }
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

export function pickFuzzDuration(min: number, max: number): number {
  const lo = Math.max(1, Math.floor(Math.min(min, max)));
  const hi = Math.max(lo, Math.floor(Math.max(min, max)));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
