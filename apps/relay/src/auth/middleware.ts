import type { FastifyReply, FastifyRequest } from 'fastify';
import { oneAuthDiscovery, verifyOneAuthToken } from '@mcp-mesh/oneauth';

export async function requireAuthenticatedRelayRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    await reply
      .code(401)
      .header('WWW-Authenticate', 'Bearer resource_metadata="/.well-known/oauth-protected-resource"')
      .send({
        error: 'unauthorized',
        message: 'Missing bearer token',
      });
    return;
  }

  const token = authorization.slice(7).trim();
  const host = request.headers.host ?? 'localhost';
  const resource = `https://${host}${request.url.startsWith('/') ? request.url : `/${request.url}`}`;

  try {
    const claims = await verifyOneAuthToken(token, {
      issuer: oneAuthDiscovery.issuer,
      expectedAudience: resource,
      requiredScopes: ['mcp:connect'],
    });

    (request as FastifyRequest & { auth?: typeof claims }).auth = claims;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid bearer token';
    await reply
      .code(401)
      .header('WWW-Authenticate', 'Bearer resource_metadata="/.well-known/oauth-protected-resource"')
      .send({
        error: 'unauthorized',
        message,
      });
  }
}
