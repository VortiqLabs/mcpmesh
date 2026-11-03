export type BridgeClientConfig = {
  relayUrl: string;
  deviceId: string;
};

export class BridgeClient {
  constructor(private readonly config: BridgeClientConfig) {}

  get relayUrl(): string {
    return this.config.relayUrl;
  }
}
