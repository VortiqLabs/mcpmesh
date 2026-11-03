export type StdioServerConfig = {
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export function createTransport(config: StdioServerConfig): StdioServerConfig {
  return {
    ...config,
    enabled: config.enabled ?? true,
    args: [...config.args],
  };
}
