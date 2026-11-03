import type { WebSocket } from 'ws';

export type ActiveConnection = {
  deviceId: string;
  socket: WebSocket;
  socketId: string;
  connectedAt: number;
  generation: number;
};

export class ConnectionRegistry {
  private readonly connections = new Map<string, ActiveConnection>();

  register(deviceId: string, socket: WebSocket): ActiveConnection {
    const previous = this.connections.get(deviceId);
    const generation = previous ? previous.generation + 1 : 1;

    const entry: ActiveConnection = {
      deviceId,
      socket,
      socketId: `${deviceId}:${generation}`,
      connectedAt: Date.now(),
      generation,
    };

    if (previous) {
      previous.socket.close(4000, 'replaced by new connection');
    }

    this.connections.set(deviceId, entry);
    return entry;
  }

  get(deviceId: string): ActiveConnection | undefined {
    return this.connections.get(deviceId);
  }

  getBySocket(socket: WebSocket): ActiveConnection | undefined {
    return [...this.connections.values()].find((connection) => connection.socket === socket);
  }

  remove(deviceId: string): void {
    this.connections.delete(deviceId);
  }

  list(): ActiveConnection[] {
    return [...this.connections.values()];
  }
}
