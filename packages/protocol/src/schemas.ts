import { z } from 'zod';

export const SUPPORTED_PROTOCOL_VERSION = 1 as const;
export const protocolVersionSchema = z.literal(SUPPORTED_PROTOCOL_VERSION);
export const requestIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/);

export const agentRegisterSchema = z.object({
  type: z.literal('agent.register'),
  version: protocolVersionSchema,
  deviceId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/),
  deviceToken: z.string().min(1).max(512).optional(),
});

export const agentHeartbeatSchema = z.object({
  type: z.literal('agent.heartbeat'),
  timestamp: z.number().int().positive(),
});

export const mcpRequestSchema = z.object({
  type: z.literal('mcp.request'),
  requestId: requestIdSchema,
  payload: z.unknown(),
});

export const mcpResponseSchema = z.object({
  type: z.literal('mcp.response'),
  requestId: requestIdSchema,
  payload: z.unknown(),
});

export const errorMessageSchema = z.object({
  type: z.literal('error'),
  requestId: requestIdSchema.optional(),
  code: z.string().min(1).max(128),
  message: z.string().min(1).max(512),
});

export const protocolMessageSchema = z.union([
  agentRegisterSchema,
  agentHeartbeatSchema,
  mcpRequestSchema,
  mcpResponseSchema,
  errorMessageSchema,
]);
