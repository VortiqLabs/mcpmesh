export function calculateBackoff(attempt: number, capMs = 60_000): number {
  const base = 1000;
  const backoff = Math.min(base * 2 ** attempt, capMs);
  return backoff + Math.floor(Math.random() * 250);
}
