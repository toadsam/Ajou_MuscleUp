/**
 * Per-socket token buckets. Each event category gets `capacity` tokens that refill at
 * `refillPerSec`. An event that finds the bucket empty is dropped silently.
 * A socket that keeps getting dropped (> MAX_DROPS_PER_MINUTE) is disconnected.
 */

export type LimitCategory =
  | "join"
  | "move"
  | "chat"
  | "social"
  | "ping"
  | "friend";

const LIMITS: Record<LimitCategory, { capacity: number; refillPerSec: number }> = {
  join: { capacity: 3, refillPerSec: 0.1 },
  move: { capacity: 40, refillPerSec: 25 }, // client sends every 80ms (12.5/s)
  chat: { capacity: 5, refillPerSec: 0.5 },
  social: { capacity: 4, refillPerSec: 1 },
  ping: { capacity: 4, refillPerSec: 2 },
  friend: { capacity: 5, refillPerSec: 1 },
};

export const MAX_DROPS_PER_MINUTE = 300;

type Bucket = { tokens: number; last: number };

export class SocketRateLimiter {
  private buckets = new Map<LimitCategory, Bucket>();
  private drops = 0;
  private dropWindowStart = Date.now();

  /** returns true when the event may proceed */
  take(category: LimitCategory): boolean {
    const { capacity, refillPerSec } = LIMITS[category];
    const now = Date.now();
    let bucket = this.buckets.get(category);
    if (!bucket) {
      bucket = { tokens: capacity, last: now };
      this.buckets.set(category, bucket);
    }
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.last) / 1000) * refillPerSec);
    bucket.last = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    if (now - this.dropWindowStart > 60_000) {
      this.dropWindowStart = now;
      this.drops = 0;
    }
    this.drops += 1;
    return false;
  }

  get abusive() {
    return this.drops > MAX_DROPS_PER_MINUTE;
  }
}
