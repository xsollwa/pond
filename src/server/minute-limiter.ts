export class MinuteLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  allow(key: string, limit = 6) {
    const now = Date.now();
    for (const [k, v] of this.buckets)
      if (v.until <= now) this.buckets.delete(k);
    if (this.buckets.size >= 10000 && !this.buckets.has(key)) return false;
    const entry = this.buckets.get(key) ?? { count: 0, until: now + 60000 };
    entry.count++;
    this.buckets.set(key, entry);
    return entry.count <= limit;
  }
}
