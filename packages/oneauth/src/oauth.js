import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose';
import { oneAuthDiscovery } from './discovery.js';
export function isValidAudience(audience, expected) {
    if (!audience) {
        return false;
    }
    const values = Array.isArray(audience) ? audience : [audience];
    return values.includes(expected);
}
export function normalizeScopes(scope) {
    if (!scope) {
        return [];
    }
    const values = Array.isArray(scope) ? scope : [scope];
    return values.flatMap((entry) => entry.split(/\s+/).filter(Boolean));
}
export async function verifyOneAuthToken(token, options = {}) {
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
    return payload;
}
//# sourceMappingURL=oauth.js.map