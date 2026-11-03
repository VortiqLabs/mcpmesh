import { describe, expect, it } from 'vitest';
import { ConnectionRegistry } from '../apps/relay/src/registry.ts';
import { RateLimiter } from '../apps/relay/src/rate-limiter.ts';
import { validateWebSocketMessage } from '../apps/relay/src/websocket.ts';

describe('phase 7 reliability and security', () => {
  it('replaces stale device connections with a higher generation', () => {
    const registry = new ConnectionRegistry();
    const first = { readyState: 1, close: () => undefined } as any;
    const second = { readyState: 1, close: () => undefined } as any;

    const entry1 = registry.register('device_123', first);
    const entry2 = registry.register('device_123', second);

    expect(entry1.generation).toBe(1);
    expect(entry2.generation).toBe(2);
    expect(registry.get('device_123')?.socket).toBe(second);
  });

  it('rejects oversized messages and rate-limits bursts', () => {
    const oversized = validateWebSocketMessage(JSON.stringify({ type: 'agent.heartbeat', timestamp: Date.now() }).padEnd(256 * 1024, 'x'));
    expect(oversized.success).toBe(false);

    const limiter = new RateLimiter({ windowMs: 1_000, maxRequests: 2 });
    expect(limiter.check('device_123')).toBe(true);
    expect(limiter.check('device_123')).toBe(true);
    expect(limiter.check('device_123')).toBe(false);
  });
});
