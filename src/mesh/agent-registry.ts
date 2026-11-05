import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { config } from '../config.js';

interface PendingCall { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout }
interface AgentConnection { socket: WebSocket; organizationId: string; agentId: string; lastSeenAt: number; pending: Map<string, PendingCall> }

export class AgentRegistry {
  private readonly connections = new Map<string, AgentConnection>();

  attach(agentId: string, organizationId: string, socket: WebSocket): void {
    const old = this.connections.get(agentId);
    if (old) { old.socket.close(4001, 'replaced by a newer connection'); this.detachIfCurrent(old, 'replaced by a newer connection'); }
    const connection: AgentConnection = { socket, organizationId, agentId, lastSeenAt: Date.now(), pending: new Map() };
    this.connections.set(agentId, connection);
    socket.on('message', (raw) => this.onMessage(connection, raw.toString()));
    socket.on('pong', () => { connection.lastSeenAt = Date.now(); });
    socket.on('close', () => this.detachIfCurrent(connection, 'agent disconnected'));
    socket.on('error', () => this.detachIfCurrent(connection, 'agent socket error'));
  }

  isOnline(agentId: string, organizationId: string): boolean {
    const c = this.connections.get(agentId);
    return Boolean(c && c.organizationId === organizationId && c.socket.readyState === WebSocket.OPEN);
  }

  listOnline(organizationId: string): Array<{ agentId: string; lastSeenAt: string }> {
    return [...this.connections.values()].filter((c) => c.organizationId === organizationId && c.socket.readyState === WebSocket.OPEN).map((c) => ({ agentId: c.agentId, lastSeenAt: new Date(c.lastSeenAt).toISOString() }));
  }

  callTool(agentId: string, organizationId: string, toolName: string, args: unknown): Promise<unknown> {
    const connection = this.connections.get(agentId);
    if (!connection || connection.organizationId !== organizationId || connection.socket.readyState !== WebSocket.OPEN) throw new Error('Agent is offline or not authorized');
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { connection.pending.delete(requestId); reject(new Error(`Agent request timed out after ${config.AGENT_REQUEST_TIMEOUT_MS}ms`)); }, config.AGENT_REQUEST_TIMEOUT_MS);
      connection.pending.set(requestId, { resolve, reject, timeout });
      connection.socket.send(JSON.stringify({ type: 'tool.call', id: requestId, toolName, arguments: args }), (error) => {
        if (error) { clearTimeout(timeout); connection.pending.delete(requestId); reject(error); }
      });
    });
  }

  heartbeatSweep(): void {
    const now = Date.now();
    for (const connection of this.connections.values()) {
      if (now - connection.lastSeenAt > config.AGENT_HEARTBEAT_TIMEOUT_MS) { connection.socket.terminate(); this.detachIfCurrent(connection, 'heartbeat timeout'); }
      else if (connection.socket.readyState === WebSocket.OPEN) connection.socket.ping();
    }
  }

  close(): void { for (const c of this.connections.values()) c.socket.close(1001, 'relay shutting down'); this.connections.clear(); }

  private onMessage(connection: AgentConnection, raw: string): void {
    if (Buffer.byteLength(raw) > config.MAX_AGENT_MESSAGE_BYTES) { connection.socket.close(1009, 'message too large'); return; }
    connection.lastSeenAt = Date.now();
    let message: unknown;
    try { message = JSON.parse(raw); } catch { connection.socket.close(1003, 'invalid JSON'); return; }
    if (!message || typeof message !== 'object') return;
    const data = message as Record<string, unknown>;
    if (data.type === 'agent.pong' || data.type === 'agent.heartbeat') return;
    if (data.type === 'tool.result' && typeof data.id === 'string') {
      const pending = connection.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timeout); connection.pending.delete(data.id);
      if (data.error) pending.reject(new Error(typeof data.error === 'string' ? data.error : 'Agent tool failed'));
      else pending.resolve(data.result);
    }
  }

  private detachIfCurrent(connection: AgentConnection, reason: string): void {
    if (this.connections.get(connection.agentId) !== connection) return;
    this.connections.delete(connection.agentId);
    for (const pending of connection.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error(reason)); }
    connection.pending.clear();
  }
}
