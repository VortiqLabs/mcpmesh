export type McpBridgeRequest = {
  requestId: string;
  payload: unknown;
};

export type McpBridgeResult = {
  requestId: string;
  payload: unknown;
  ok: boolean;
};

export class McpBridge {
  private readonly handlers = new Map<string, (payload: unknown) => Promise<unknown>>();

  registerHandler(serverName: string, handler: (payload: unknown) => Promise<unknown>): void {
    this.handlers.set(serverName, handler);
  }

  async forward(serverName: string, requestId: string, payload: unknown): Promise<McpBridgeResult> {
    const handler = this.handlers.get(serverName);

    if (!handler) {
      return {
        requestId,
        payload: { error: 'NO_HANDLER' },
        ok: false,
      };
    }

    const result = await handler(payload);
    return {
      requestId,
      payload: result,
      ok: true,
    };
  }
}

export function createBridgeRequest(requestId: string, payload: unknown): McpBridgeRequest {
  return { requestId, payload };
}
