import { describe, expect, it } from 'vitest';
import { protocolMessageSchema } from '../packages/protocol/src/index.ts';

describe('project scaffold', () => {
  it('accepts a valid agent registration message', () => {
    const result = protocolMessageSchema.safeParse({
      type: 'agent.register',
      version: 1,
      deviceId: 'device_123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported protocol message shape', () => {
    const result = protocolMessageSchema.safeParse({
      type: 'agent.register',
      version: 0,
      deviceId: '',
    });

    expect(result.success).toBe(false);
  });
});
