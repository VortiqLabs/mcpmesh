export type OAuthProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
};

export function buildResourceMetadata(resource: string): OAuthProtectedResourceMetadata {
  return {
    resource,
    authorization_servers: ['https://oneauth.nishantapps.in'],
    scopes_supported: ['mcp:connect', 'mcp:tools', 'mcp:tools:write'],
    bearer_methods_supported: ['header'],
  };
}
