export type OneAuthClientConfig = {
  issuer: string;
  clientId?: string;
};

export class OneAuthClient {
  constructor(private readonly config: OneAuthClientConfig) {}

  get issuer(): string {
    return this.config.issuer;
  }
}
