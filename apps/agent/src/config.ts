import { z } from 'zod';

export const localServerConfigSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
});

export const agentConfigSchema = z.object({
  relayUrl: z.string().url(),
  deviceId: z.string().min(1).max(128),
  deviceToken: z.string().min(8),
  servers: z.record(localServerConfigSchema).default({}),
  heartbeatMs: z.number().int().positive().default(25_000),
  reconnectMaxMs: z.number().int().positive().default(60_000),
});

const envConfig = {
  relayUrl: process.env.RELAY_URL ?? 'ws://127.0.0.1:3000',
  deviceId: process.env.DEVICE_ID ?? 'device_placeholder',
  deviceToken: process.env.DEVICE_TOKEN ?? 'placeholder-device-token',
  servers: (() => {
    const rawValue = process.env.MCP_SERVERS;

    if (!rawValue) {
      return {};
    }

    try {
      return JSON.parse(rawValue) as Record<string, z.infer<typeof localServerConfigSchema>>;
    } catch {
      return {};
    }
  })(),
  heartbeatMs: Number(process.env.AGENT_HEARTBEAT_INTERVAL_SECONDS ?? 25) * 1000,
  reconnectMaxMs: Number(process.env.AGENT_RECONNECT_MAX_SECONDS ?? 60) * 1000,
};

export const env = agentConfigSchema.parse(envConfig);

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type LocalServerConfig = z.infer<typeof localServerConfigSchema>;
