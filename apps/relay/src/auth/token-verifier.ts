import { z } from 'zod';

export const verifiedTokenSchema = z.object({
  sub: z.string(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  scope: z.string().optional(),
});

export type VerifiedToken = z.infer<typeof verifiedTokenSchema>;

export function verifyToken(token: string): VerifiedToken {
  const payload = token.split('.')[1];

  if (!payload) {
    throw new Error('Malformed token');
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; iss?: string; aud?: string | string[]; exp?: number; scope?: string };

  return verifiedTokenSchema.parse({
    sub: decoded.sub,
    iss: decoded.iss,
    aud: decoded.aud,
    exp: decoded.exp,
    scope: decoded.scope,
  });
}
