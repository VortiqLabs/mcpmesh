export const oneAuthDiscovery = {
  issuer: 'https://oneauth.nishantapps.in',
  authorization_endpoint: 'https://oneauth.nishantapps.in/oauth/authorize',
  token_endpoint: 'https://oneauth.nishantapps.in/oauth/token',
  jwks_uri: 'https://oneauth.nishantapps.in/.well-known/jwks.json',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  scopes_supported: ['mcp:connect', 'mcp:tools', 'mcp:tools:write'],
};
