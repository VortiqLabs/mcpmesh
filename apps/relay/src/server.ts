import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import Fastify from 'fastify';
import { buildResourceMetadata } from './auth/resource-metadata.js';
import { env } from './config.js';
import { DeviceService } from './device/device-service.js';
import { PairingService } from './pairing.js';
import { ConnectionRegistry } from './registry.js';
import { RequestManager } from './request-manager.js';
import { RateLimiter } from './rate-limiter.js';
import { createRelayWebSocketServer } from './websocket.js';

function createRelayToolServer(deviceId: string) {
  const server = new McpServer(
    {
      name: 'relay-mcp-server',
      version: '1.0.0',
    },
    { capabilities: {} },
  );

  server.registerTool(
    'echo',
    {
      description: 'Echo text routed through the relay for a specific device.',
      inputSchema: {
        text: z.string().describe('Text to echo back from the target device'),
      },
    },
    async ({ text }) => ({
      content: [
        {
          type: 'text',
          text: `device=${deviceId} :: ${text}`,
        },
      ],
    }),
  );

  return server;
}

export function createRelayApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  const connectionRegistry = new ConnectionRegistry();
  const requestManager = new RequestManager(env.MCP_REQUEST_TIMEOUT_MS);
  const deviceService = new DeviceService();
  const pairingService = new PairingService(env.AGENT_PAIRING_TTL_SECONDS * 1000);
  const relayRateLimiter = new RateLimiter({
    windowMs: env.RELAY_RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RELAY_RATE_LIMIT_MAX_REQUESTS,
  });
  const mcpSessions = new Map<
    string,
    { deviceId: string; transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  createRelayWebSocketServer({
    server: app.server,
    registry: connectionRegistry,
    requestManager,
    deviceService,
    rateLimiter: relayRateLimiter,
    maxMessageBytes: env.RELAY_MAX_MESSAGE_BYTES,
  });

  const getOrCreateSession = async (deviceId: string, sessionId?: string) => {
    const existingSession = sessionId ? mcpSessions.get(sessionId) : undefined;
    if (existingSession) {
      return existingSession;
    }

    const server = createRelayToolServer(deviceId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (nextSessionId) => {
        if (!mcpSessions.has(nextSessionId)) {
          mcpSessions.set(nextSessionId, { deviceId, transport, server });
        }
      },
      onsessionclosed: async (nextSessionId) => {
        const session = mcpSessions.get(nextSessionId);
        if (!session) {
          return;
        }

        try {
          await session.server.close();
        } finally {
          mcpSessions.delete(nextSessionId);
        }
      },
    });

    await server.connect(transport);
    return { deviceId, transport, server };
  };

  const handleMcpRequest: any = async (request: any, reply: any) => {
    const queryDeviceId = typeof request.query?.deviceId === 'string' ? request.query.deviceId : undefined;
    const headerDeviceId = typeof request.headers['x-device-id'] === 'string' ? request.headers['x-device-id'] : undefined;
    const deviceId = headerDeviceId ?? queryDeviceId ?? 'default-device';
    const requestedSessionId =
      typeof request.headers['mcp-session-id'] === 'string'
        ? request.headers['mcp-session-id']
        : typeof request.headers['x-mcp-session-id'] === 'string'
          ? request.headers['x-mcp-session-id']
          : undefined;

    const session = await getOrCreateSession(deviceId, requestedSessionId);

    try {
      await session.transport.handleRequest(request.raw, reply.raw, request.body as unknown);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown MCP transport error';
      return reply.code(500).send({
        error: 'transport_error',
        message,
      });
    }
  };

  app.get('/health', async () => ({
    status: 'ok',
    service: 'relay',
    environment: env.NODE_ENV,
  }));

  app.get('/ready', async () => ({
    status: 'ready',
    service: 'relay',
    connectedDevices: connectionRegistry.list().length,
  }));

  app.get('/.well-known/oauth-protected-resource', async (request, reply) => {
    const host = request.headers.host ?? `${env.HOST}:${env.PORT}`;
    const resource = `https://${host}/mcp`;

    return reply.send(buildResourceMetadata(resource));
  });

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    handler: handleMcpRequest,
  });

  app.get('/v1/devices/:id', async (request, reply) => {
    const deviceId = String((request.params as { id?: string }).id ?? '');
    const device = deviceService.get(deviceId);

    return reply.code(200).send({
      deviceId,
      status: device ? device.status : connectionRegistry.get(deviceId) ? 'connected' : 'not_connected',
    });
  });

  app.post('/v1/devices/pair', async (request, reply) => {
    const body = (request.body ?? {}) as { ownerSubject?: string; deviceName?: string };
    const ownerSubject = body.ownerSubject?.trim() || 'unknown-user';
    const issued = pairingService.issue({
      ownerSubject,
      deviceName: body.deviceName,
      ttlMs: env.AGENT_PAIRING_TTL_SECONDS * 1000,
    });

    return reply.code(200).send({
      status: 'ok',
      code: issued.code,
      expiresAt: issued.expiresAt.toISOString(),
    });
  });

  app.post('/v1/devices/pair/complete', async (request, reply) => {
    const body = (request.body ?? {}) as { deviceId?: string; ownerSubject?: string; deviceName?: string; code?: string };
    const deviceId = body.deviceId?.trim();
    const ownerSubject = body.ownerSubject?.trim() || 'unknown-user';
    const code = body.code?.trim();

    if (!deviceId || !code) {
      return reply.code(400).send({
        status: 'error',
        message: 'deviceId and code are required.',
      });
    }

    const record = pairingService.consume(code, { deviceId, ownerSubject });
    if (!record) {
      return reply.code(400).send({
        status: 'error',
        message: 'Pairing code is invalid, expired, or already used.',
      });
    }

    const credential = deviceService.createCredential({
      deviceId,
      ownerSubject,
      name: body.deviceName || 'paired-device',
    });

    return reply.code(200).send({
      status: 'ok',
      deviceId,
      ownerSubject,
      credential,
      expiresAt: record.expiresAt.toISOString(),
    });
  });

  app.post('/v1/devices/:id/revoke', async (request, reply) => {
    const deviceId = String((request.params as { id?: string }).id ?? '');
    const revoked = deviceService.revoke(deviceId);

    return reply.code(revoked ? 200 : 404).send({
      status: revoked ? 'revoked' : 'not_found',
      deviceId,
    });
  });

  app.addHook('onClose', async () => {
    for (const connection of connectionRegistry.list()) {
      connection.socket.close();
    }
  });

  return { app, connectionRegistry, requestManager, deviceService, pairingService };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const { app } = createRelayApp();
  app.listen({ host: env.HOST, port: env.PORT }).then(() => {
    app.log.info({ port: env.PORT, host: env.HOST }, 'relay started');
  });
}

export const app = createRelayApp().app;
