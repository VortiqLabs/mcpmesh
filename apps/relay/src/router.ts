export type RelayRoute = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
};

export const relayRoutes: RelayRoute[] = [
  { method: 'GET', path: '/health', description: 'Health check endpoint' },
  { method: 'GET', path: '/ready', description: 'Readiness check endpoint' },
  { method: 'GET', path: '/mcp', description: 'MCP streamable HTTP endpoint' },
  { method: 'POST', path: '/mcp', description: 'MCP streamable HTTP endpoint' },
  { method: 'DELETE', path: '/mcp', description: 'MCP session teardown endpoint' },
  { method: 'GET', path: '/.well-known/oauth-protected-resource', description: 'OAuth resource metadata' },
];

export function registerRelayRoutes(): RelayRoute[] {
  return relayRoutes;
}
