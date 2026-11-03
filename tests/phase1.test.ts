import { describe, expect, it } from 'vitest';
import { agentRegisterSchema, protocolMessageSchema, requestIdSchema } from '../packages/protocol/src/index.ts';
import { agentEvents, pairingCodes } from '../packages/database/src/index.ts';

describe('phase 1 protocol and database contracts', () => {
  it('accepts valid agent registration payloads', () => {
    const result = agentRegisterSchema.safeParse({
      type: 'agent.register',
      version: 1,
      deviceId: 'device_123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid request IDs and unsupported versions', () => {
    expect(requestIdSchema.safeParse('').success).toBe(false);
    expect(protocolMessageSchema.safeParse({ type: 'agent.register', version: 2, deviceId: 'device_123' }).success).toBe(false);
  });

  it('exposes pairing and event metadata tables', () => {
    expect(pairingCodes).toBeDefined();
    expect(agentEvents).toBeDefined();
  });
});
