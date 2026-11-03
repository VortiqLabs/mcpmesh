import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  MESH_BASE_DOMAIN: z.string().default('mcp.nishantapps.in'),
  AGENT_PAIRING_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  RELAY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),
  RELAY_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
  RELAY_MAX_MESSAGE_BYTES: z.coerce.number().int().positive().default(256 * 1024),
  ONEAUTH_ISSUER: z.string().default('https://oneauth.nishantapps.in'),
  ONEAUTH_CLIENT_ID: z.string().optional().default(''),
  ONEAUTH_CLIENT_SECRET: z.string().optional().default(''),
  ONEAUTH_INTERNAL_API_URL: z.string().optional().default(''),
  ONEAUTH_INTERNAL_API_TOKEN: z.string().optional().default(''),
  MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export const env = configSchema.parse(process.env);

export type RelayConfig = z.infer<typeof configSchema>;
