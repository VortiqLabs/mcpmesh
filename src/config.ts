import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PUBLIC_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  ONEAUTH_ISSUER: z.string().url(),
  ONEAUTH_JWKS_URI: z.string().url(),
  ONEAUTH_AUDIENCE: z.string().min(1),
  ONEAUTH_DISCOVERY_URL: z.string().url(),
  AGENT_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(15_000),
  AGENT_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().min(3000).default(45_000),
  AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(30_000),
  MAX_AGENT_MESSAGE_BYTES: z.coerce.number().int().min(1024).max(10_485_760).default(1_048_576),
  ALLOWED_HOSTS: z.string().default('localhost,127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${z.treeifyError(parsed.error).errors.join('\n')}`);
}

export const config = {
  ...parsed.data,
  allowedHosts: parsed.data.ALLOWED_HOSTS.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean),
};
