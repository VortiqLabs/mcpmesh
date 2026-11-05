import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

export interface Principal {
  subject: string;
  organizationId: string;
  scopes: string[];
  claims: JWTPayload;
}

const issuer = config.ONEAUTH_ISSUER.replace(/\/$/, '');
const jwks = createRemoteJWKSet(new URL(config.ONEAUTH_JWKS_URI), { timeoutDuration: 5_000, cooldownDuration: 30_000, cacheMaxAge: 600_000 });

export async function verifyOneAuthConfiguration(): Promise<void> {
  const response = await fetch(config.ONEAUTH_DISCOVERY_URL, { signal: AbortSignal.timeout(8_000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`OneAuth discovery failed: HTTP ${response.status}`);
  const metadata: unknown = await response.json();
  if (!metadata || typeof metadata !== 'object') throw new Error('OneAuth discovery returned invalid metadata');
  const doc = metadata as Record<string, unknown>;
  if (doc.issuer !== issuer) throw new Error(`OneAuth issuer mismatch: configured ${issuer}, discovery advertises ${String(doc.issuer)}. Fix OneAuth canonical issuer before starting MCP Mesh.`);
  if (doc.jwks_uri !== config.ONEAUTH_JWKS_URI) throw new Error(`OneAuth JWKS mismatch: configured ${config.ONEAUTH_JWKS_URI}, discovery advertises ${String(doc.jwks_uri)}.`);
}

export async function verifyBearerToken(header: string | undefined): Promise<Principal> {
  if (!header?.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const token = header.slice(7).trim();
  if (!token) throw new Error('Missing bearer token');
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: config.ONEAUTH_AUDIENCE, algorithms: ['RS256', 'ES256', 'EdDSA'] });
  const subject = payload.sub;
  const organizationId = typeof payload.org_id === 'string' ? payload.org_id : typeof payload.organization_id === 'string' ? payload.organization_id : undefined;
  const scopes = Array.isArray(payload.scopes) ? payload.scopes.filter((v): v is string => typeof v === 'string') : typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [];
  if (!subject || !organizationId) throw new Error('Token is missing required sub or organization claim');
  return { subject, organizationId, scopes, claims: payload };
}
