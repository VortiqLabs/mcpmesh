import { describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { AgentConnection } from '../apps/agent/src/connection.ts';
import { agentConfigSchema } from '../apps/agent/src/config.ts';
import { ProcessManager } from '../apps/agent/src/process-manager.ts';
import { calculateBackoff } from '../apps/agent/src/reconnect.ts';

describe('phase 3 agent lifecycle', () => {
  it('validates the local server configuration schema', () => {
    const result = agentConfigSchema.safeParse({
      relayUrl: 'ws://127.0.0.1:3000',
      deviceId: 'device_123',
      deviceToken: 'device-secret-123',
      servers: {
        filesystem: {
          transport: 'stdio',
          command: 'node',
          args: ['-e', 'console.log("ok")'],
          enabled: true,
          env: { TEST_MODE: '1' },
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('calculates reconnect backoff with jitter and cap', () => {
    const first = calculateBackoff(0, 10000);
    const second = calculateBackoff(2, 10000);

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(10000);
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThanOrEqual(10000);
  });

  it('connects to the relay and registers the device', async () => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => {
      server.once('listening', resolve);
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const connection = new AgentConnection({
      relayUrl: `ws://127.0.0.1:${port}`,
      deviceId: 'device_123',
      deviceToken: 'device-secret-123',
      heartbeatMs: 250,
    });

    await new Promise<void>((resolve, reject) => {
      server.once('connection', (socket) => {
        socket.on('message', (message) => {
          const payload = JSON.parse(message.toString()) as { type?: string; deviceId?: string };
          if (payload.type === 'agent.register') {
            expect(payload.deviceId).toBe('device_123');
            resolve();
          }
        });
      });

      server.once('error', reject);
      void connection.connect().catch(reject);
    });

    expect(connection.state).toBe('connected');
    await connection.close();
    server.close();
  }, 15000);

  it('starts and stops a managed local process', async () => {
    const manager = new ProcessManager();

    const instance = await manager.startProcess({
      name: 'echo',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
    });

    expect(instance.name).toBe('echo');
    expect(manager.list().length).toBe(1);

    await manager.stopProcess('echo');
    expect(manager.list().length).toBe(0);
  }, 15000);
});
