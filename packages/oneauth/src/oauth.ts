import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWK } from 'jose';
import { oneAuthDiscovery } from './discovery.js';
import type { OneAuthTokenClaims } from './types.js';

export type OneAuthValidationOptions = {
  issuer?: string;
  expectedAudience?: string;
  resource?: string;
  requiredScopes?: string[];
  jwks?: { keys: JWK[] };
  jwksUri?: string;
};

export function isValidAudience(audience: string | string[] | undefined, expected: string): boolean {
  if (!audience) {
    return false;
  }

  const values = Array.isArray(audience) ? audience : [audience];
  return values.includes(expected);
}

export function normalizeScopes(scope: string | string[] | undefined): string[] {
  if (!scope) {
    return [];
  }

  const values = Array.isArray(scope) ? scope : [scope];
  return values.flatMap((entry) => entry.split(/\s+/).filter(Boolean));
}

export async function verifyOneAuthToken(
  token: string,
  options: OneAuthValidationOptions = {},
): Promise<OneAuthTokenClaims> {
  if (!token || !token.trim()) {
    throw new Error('Missing bearer token');
  }

  const issuer = options.issuer ?? oneAuthDiscovery.issuer;
  const resource = options.expectedAudience ?? options.resource;
  const jwks = options.jwks ?? undefined;
  const jwksUri = options.jwksUri ?? oneAuthDiscovery.jwks_uri;

  const keySet = jwks
    ? createLocalJWKSet(jwks)
    : createRemoteJWKSet(new URL(jwksUri));

  const { payload } = await jwtVerify(token, keySet, { issuer });

  const audience = payload.aud;
  if (resource && !isValidAudience(audience, resource)) {
    throw new Error(`Token audience mismatch for resource ${resource}`);
  }

  const requiredScopes = options.requiredScopes ?? [];
  const tokenScopes = new Set(normalizeScopes(typeof payload.scope === 'string' ? payload.scope : undefined));

  for (const requiredScope of requiredScopes) {
    if (!tokenScopes.has(requiredScope)) {
      throw new Error(`Token missing required scope: ${requiredScope}`);
    }
  }

  return payload as OneAuthTokenClaims;
}
