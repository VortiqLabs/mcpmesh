export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly options: RateLimitOptions) {}

  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.buckets.get(key) ?? [];
    const windowStart = now - this.options.windowMs;
    const active = timestamps.filter((timestamp) => timestamp > windowStart);

    if (active.length >= this.options.maxRequests) {
      this.buckets.set(key, active);
      return false;
    }

    active.push(now);
    this.buckets.set(key, active);
    return true;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
