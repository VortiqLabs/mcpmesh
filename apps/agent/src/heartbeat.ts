export function createHeartbeat(intervalMs: number, onTick: () => void): NodeJS.Timeout {
  return setInterval(onTick, intervalMs);
}
