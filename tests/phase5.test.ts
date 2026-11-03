import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { requireAuthenticatedRelayRequest } from '../apps/relay/src/auth/middleware.ts';
import { verifyOneAuthToken } from '../packages/oneauth/src/oauth.ts';

describe('phase 5 oneauth integration', () => {
  it('rejects missing and invalid bearer tokens', async () => {
    const events: Array<{ status?: number; body?: unknown }> = [];
    const reply = {
      code: (status: number) => {
        events.push({ status });
        return reply;
      },
      header: () => reply,
      send: (body: unknown) => {
        events.push({ body });
        return body;
      },
    } as any;

    await expect(requireAuthenticatedRelayRequest({ headers: {} } as any, reply)).resolves.toBeUndefined();
    expect(events[0]?.status).toBe(401);

    const invalidReply = {
      code: (status: number) => {
        events.push({ status });
        return invalidReply;
      },
      header: () => invalidReply,
      send: (body: unknown) => {
        events.push({ body });
        return body;
      },
    } as any;

    await expect(
      requireAuthenticatedRelayRequest({ headers: { authorization: 'Bearer invalid' }, url: '/mcp' } as any, invalidReply),
    ).resolves.toBeUndefined();
    expect(events.findLast((event) => 'status' in event)?.status).toBe(401);
  });

  it('validates a signed OneAuth access token with issuer and audience checks', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const jwk = await import('jose').then(async ({ exportJWK }) => ({
      ...(await exportJWK(createPublicKey(publicKey))),
      kid: 'phase5-key',
      use: 'sig',
      alg: 'RS256',
    }));
    const jwt = await import('jose').then(({ SignJWT }) =>
      new SignJWT({
        sub: 'user_123',
        scope: 'mcp:connect mcp:tools',
        aud: 'https://a8f3k2.mcp.nishantapps.in/mcp',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'phase5-key' })
        .setIssuer('https://oneauth.nishantapps.in')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(createPrivateKey(privateKey)),
    );

    const claims = await verifyOneAuthToken(jwt, {
      issuer: 'https://oneauth.nishantapps.in',
      expectedAudience: 'https://a8f3k2.mcp.nishantapps.in/mcp',
      requiredScopes: ['mcp:connect'],
      jwks: { keys: [jwk] },
    });

    expect(claims.sub).toBe('user_123');
    expect(claims.iss).toBe('https://oneauth.nishantapps.in');
    expect(claims.aud).toContain('https://a8f3k2.mcp.nishantapps.in/mcp');
  });
});
