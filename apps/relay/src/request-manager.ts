export type PendingRequest = {
  deviceId: string;
  createdAt: number;
  expiresAt: number;
};

export class RequestManager {
  private readonly pendingRequests = new Map<string, PendingRequest>();

  constructor(private readonly requestTimeoutMs = 30_000) {}

  createRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  register(requestId: string, deviceId: string): PendingRequest {
    const now = Date.now();
    const entry: PendingRequest = {
      deviceId,
      createdAt: now,
      expiresAt: now + this.requestTimeoutMs,
    };

    this.pendingRequests.set(requestId, entry);
    return entry;
  }

  resolve(requestId: string): PendingRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  clear(requestId: string): void {
    this.pendingRequests.delete(requestId);
  }

  clearDeviceRequests(deviceId: string): number {
    let removed = 0;

    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (request.deviceId === deviceId) {
        this.pendingRequests.delete(requestId);
        removed += 1;
      }
    }

    return removed;
  }

  cleanupExpired(now = Date.now()): string[] {
    const expired: string[] = [];

    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (now > request.expiresAt) {
        expired.push(requestId);
        this.pendingRequests.delete(requestId);
      }
    }

    return expired;
  }
}
