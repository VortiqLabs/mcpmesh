import { WebSocket } from 'ws';
import { createHeartbeat } from './heartbeat.js';

export type AgentConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'stale';

export type AgentConnectionOptions = {
  relayUrl: string;
  deviceId: string;
  deviceToken: string;
  heartbeatMs?: number;
};

export class AgentConnection {
  public state: AgentConnectionState = 'connecting';
  private socket: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: AgentConnectionOptions) {}

  async connect(): Promise<WebSocket> {
    this.state = 'connecting';

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.relayUrl);
      this.socket = socket;

      socket.on('open', () => {
        this.state = 'connected';
        socket.send(
          JSON.stringify({
            type: 'agent.register',
            version: 1,
            deviceId: this.options.deviceId,
            deviceToken: this.options.deviceToken,
          }),
        );

        this.heartbeatTimer = createHeartbeat(this.options.heartbeatMs ?? 25_000, () => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'agent.heartbeat', timestamp: Date.now() }));
          }
        });

        resolve(socket);
      });

      socket.on('message', (message) => {
        const payload = JSON.parse(message.toString()) as { type?: string };

        if (payload.type === 'error') {
          this.state = 'stale';
          return;
        }

        if (payload.type === 'agent.registered') {
          this.state = 'connected';
        }
      });

      socket.on('close', () => {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }

        this.state = 'reconnecting';
      });

      socket.on('error', (error) => {
        this.state = 'stale';
        reject(error);
      });
    });
  }

  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }

    this.state = 'stale';
  }

  reconnect(): void {
    this.state = 'reconnecting';
  }
}
