import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createRelayApp } from '../apps/relay/src/server.ts';

describe('phase 2 relay', () => {
  let activeServer: ReturnType<typeof createRelayApp> | undefined;

  afterEach(async () => {
    if (activeServer) {
      for (const connection of activeServer.connectionRegistry.list()) {
        connection.socket.terminate();
      }

      await activeServer.app.close();
      activeServer = undefined;
    }
  });

  it('exposes health and metadata endpoints', async () => {
    activeServer = createRelayApp();
    await activeServer.app.ready();
    await activeServer.app.listen({ host: '127.0.0.1', port: 0 });

    const address = activeServer.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const healthBody = (await healthResponse.json()) as { status: string };

    expect(healthResponse.status).toBe(200);
    expect(healthBody.status).toBe('ok');

    const metadataResponse = await fetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`);
    const metadataBody = (await metadataResponse.json()) as { resource: string };

    expect(metadataResponse.status).toBe(200);
    expect(metadataBody.resource).toContain('/mcp');
  });

  it('registers agents and correlates request IDs', async () => {
    activeServer = createRelayApp();
    await activeServer.app.ready();
    await activeServer.app.listen({ host: '127.0.0.1', port: 0 });

    const address = activeServer.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/agent/connect`);

    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });

    socket.send(JSON.stringify({ type: 'agent.register', version: 1, deviceId: 'device_abc' }));

    const registrationMessage = await new Promise<string>((resolve, reject) => {
      socket.once('message', (payload) => resolve(payload.toString()));
      socket.once('error', reject);
    });

    const registration = JSON.parse(registrationMessage) as { status?: string; deviceId?: string };
    expect(registration.status).toBe('ok');
    expect(registration.deviceId).toBe('device_abc');

    const requestId = 'req_123';
    socket.send(JSON.stringify({ type: 'mcp.request', requestId, payload: { method: 'tools/list' } }));

    const requestAck = await new Promise<string>((resolve, reject) => {
      socket.once('message', (payload) => resolve(payload.toString()));
      socket.once('error', reject);
    });

    expect(JSON.parse(requestAck).requestId).toBe(requestId);

    const pending = activeServer.requestManager.resolve(requestId);
    expect(pending?.deviceId).toBe('device_abc');

    socket.close();
  }, 15000);
});
