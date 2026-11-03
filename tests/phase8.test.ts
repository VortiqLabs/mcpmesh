import { describe, expect, it } from 'vitest';
import { buildAgentConfigTemplate, parseAgentCliArgs } from '../apps/agent/src/cli.ts';

describe('phase 8 cli and documentation', () => {
  it('accepts the start command and resolves required values', () => {
    const parsed = parseAgentCliArgs([
      'start',
      '--relay-url',
      'wss://relay.example.com',
      '--device-id',
      'device-42',
      '--device-token',
      'super-secret-token',
    ]);

    expect(parsed.command).toBe('start');
    expect(parsed.relayUrl).toBe('wss://relay.example.com');
    expect(parsed.deviceId).toBe('device-42');
    expect(parsed.deviceToken).toBe('super-secret-token');
  });

  it('prints a usable config template for developers', () => {
    const template = buildAgentConfigTemplate();

    expect(template).toContain('RELAY_URL');
    expect(template).toContain('DEVICE_ID');
    expect(template).toContain('DEVICE_TOKEN');
    expect(template).toContain('MCP_SERVERS');
  });
});
