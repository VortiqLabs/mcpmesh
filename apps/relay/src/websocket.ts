import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { protocolMessageSchema, type ProtocolMessage } from '@mcp-mesh/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import type { ConnectionRegistry } from './registry.js';
import type { RequestManager } from './request-manager.js';
import type { DeviceService } from './device/device-service.js';
import { RateLimiter } from './rate-limiter.js';

export type RelayWebSocketServerOptions = {
  server: { on: (event: string, listener: (...args: any[]) => void) => void };
  registry: ConnectionRegistry;
  requestManager: RequestManager;
  deviceService?: DeviceService;
  path?: string;
  rateLimiter?: RateLimiter;
  maxMessageBytes?: number;
};

export function validateWebSocketMessage(
  message: string,
  maxMessageBytes = 256 * 1024,
): { success: true; data: ProtocolMessage } | { success: false; error: string } {
  if (Buffer.byteLength(message, 'utf8') > maxMessageBytes) {
    return { success: false, error: `Message exceeds the ${maxMessageBytes} byte limit.` };
  }

  try {
    const parsed = JSON.parse(message) as unknown;
    const result = protocolMessageSchema.safeParse(parsed) as { success: true; data: ProtocolMessage } | { success: false; error: { issues: Array<{ message: string }> } };

    if (!result.success) {
      return { success: false, error: result.error.issues.map((issue) => issue.message).join('; ') };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON payload',
    };
  }
}

export function createRelayWebSocketServer({
  server,
  registry,
  requestManager,
  deviceService,
  path = '/v1/agent/connect',
  rateLimiter = new RateLimiter({ windowMs: 1000, maxRequests: 20 }),
  maxMessageBytes = 256 * 1024,
}: RelayWebSocketServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '/';

    if (pathname !== path) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (socket: WebSocket) => {
    const deviceIdFromSocket = () => registry.getBySocket(socket)?.deviceId;

    socket.on('message', (rawMessage) => {
      const rawText = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString();
      const bucketKey = deviceIdFromSocket() ?? 'anonymous_socket';

      if (!rateLimiter.check(bucketKey)) {
        socket.send(JSON.stringify({ type: 'error', code: 'RATE_LIMITED', message: 'Too many messages in a short time window.' }));
        return;
      }

      const validation = validateWebSocketMessage(rawText, maxMessageBytes);

      if (!validation.success) {
        socket.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE', message: validation.error }));
        return;
      }

      const message = validation.data;

      if (message.type === 'agent.register') {
        const registerMessage = message as typeof message & { deviceToken?: string };
        const deviceId = registerMessage.deviceId;
        const token = registerMessage.deviceToken;

        if (deviceService && token) {
          const device = deviceService.get(deviceId);
          if (!device) {
            socket.send(JSON.stringify({ type: 'error', code: 'UNKNOWN_DEVICE', message: 'Device is not paired or recognized.' }));
            return;
          }

          if (device.status !== 'active' || !deviceService.verifyCredential(deviceId, token)) {
            socket.send(JSON.stringify({ type: 'error', code: 'INVALID_DEVICE_TOKEN', message: 'Device credential is invalid or revoked.' }));
            return;
          }
        }

        const connection = registry.register(deviceId, socket);
        socket.send(JSON.stringify({ type: 'agent.registered', deviceId: connection.deviceId, generation: connection.generation, status: 'ok' }));
        return;
      }

      const deviceId = deviceIdFromSocket();

      if (!deviceId) {
        socket.send(JSON.stringify({ type: 'error', code: 'UNREGISTERED_SOCKET', message: 'Device must register before sending MCP messages.' }));
        return;
      }

      if (message.type === 'agent.heartbeat') {
        socket.send(JSON.stringify({ type: 'agent.heartbeat', status: 'ok', timestamp: message.timestamp }));
        return;
      }

      if (message.type === 'mcp.request') {
        requestManager.register(message.requestId, deviceId);
        socket.send(JSON.stringify({ type: 'mcp.request.accepted', requestId: message.requestId, deviceId }));
        return;
      }

      if (message.type === 'mcp.response') {
        const pendingRequest = requestManager.resolve(message.requestId);

        if (!pendingRequest || pendingRequest.deviceId !== deviceId) {
          socket.send(JSON.stringify({ type: 'error', requestId: message.requestId, code: 'UNKNOWN_REQUEST', message: 'Response does not correlate to a pending request.' }));
          return;
        }

        requestManager.clear(message.requestId);
        socket.send(JSON.stringify({ type: 'mcp.response.accepted', requestId: message.requestId, deviceId }));
      }
    });

    socket.on('close', () => {
      const connection = registry.getBySocket(socket);
      if (connection) {
        requestManager.clearDeviceRequests(connection.deviceId);
        registry.remove(connection.deviceId);
      }
    });
  });

  return wss;
}
