# VortiqLabs MCP Mesh

OneAuth-protected MCP Streamable HTTP server with an authenticated device WebSocket gateway.

## Runtime configuration

Copy `.env.example` to `.env` and configure:

- `ONEAUTH_ISSUER_URL`: canonical OneAuth issuer URL.
- `ONEAUTH_INTROSPECTION_URL`: optional override; defaults to `${ONEAUTH_ISSUER_URL}/api/oauth/introspect`.
- `ONEAUTH_RESOURCE_URL`: exact OAuth audience for this deployment. For Codespaces, use the forwarded HTTPS URL ending in `/mcp`. Configure the identical value as `ONEAUTH_MCP_RESOURCE_URL` in OneAuth before authorizing clients.
- `ONEAUTH_RESOURCE_SERVER_KEY`: resource-server-only secret. Must match `ONEAUTH_MCP_RESOURCE_SERVER_KEY` in OneAuth.
- `PORT`, `HOST`, `MCP_PATH`, `DEVICE_WS_PATH`, `AGENT_WS_PATH`: listener settings. The `/device` gateway remains available unchanged; `/agent` is the VS Code Agent bridge.
- `ONEAUTH_AGENT_CLIENT_ID`: public OAuth client ID used by the VortiqLabs Agent extension. MCP Mesh introspects the extension token and only accepts this client for Agent WebSocket connections.
- `MCP_ALLOWED_ORIGINS`: comma-separated browser origins. An empty list rejects browser-origin requests; server-side clients without an Origin header are unaffected.

## Run

```sh
npm install
npm start
```

MCP endpoint: `POST/GET/DELETE /mcp` (Streamable HTTP)

Device gateway: `wss://your-host/device` (existing device protocol)

VS Code Agent gateway: `wss://your-host/agent` (OneAuth-authenticated Agent protocol)

Health: `/health`

Protected resource metadata: `/.well-known/oauth-protected-resource/mcp`

## OAuth setup

On OneAuth, configure `ONEAUTH_MCP_RESOURCE_URL` to exactly match this server’s `ONEAUTH_RESOURCE_URL`, and configure the same `ONEAUTH_MCP_RESOURCE_SERVER_KEY` value. The audience is an exact URL match; a token issued for another MCP host will be rejected. Register an OAuth application with the `mcp:connect` scope and Authorization Code + PKCE (S256). The MCP client requests the exact `ONEAUTH_RESOURCE_URL` as its OAuth `resource` parameter. OneAuth consent issues a short-lived opaque token for that audience. MCP Mesh validates every MCP request by calling OneAuth introspection with its resource-server key; it checks active status, issuer, exact audience, expiry, and `mcp:connect`.

Do not put the resource-server key in an MCP client, device, browser, or OAuth application. It belongs only in server-side environment variables.

## Device protocol

Connect to `/device` with `Authorization: Bearer <OneAuth access token>`. After the `connected` message, register the device:

```json
{"type":"register","deviceId":"my-device"}
```

The MCP tools `device.list` and `device.send` are scoped to the token subject. Devices are kept in memory and are removed when their WebSocket disconnects.


## VS Code Agent bridge

The VortiqLabs Agent extension opens an outbound WebSocket to `/agent` after OneAuth sign-in. It sends its OneAuth access token in the WebSocket Authorization header; MCP Mesh introspects the token, checks the issuer, expiry, `openid` scope, and the configured extension OAuth client ID, then binds the connection to the verified OneAuth subject. The Agent registration payload contains only workspace/instance metadata; it cannot choose or spoof the authenticated subject.

MCP Mesh keeps an in-memory registry keyed by verified subject and Agent instance. The `agent.list` and `agent.select` tools let a user inspect and select among multiple connected VS Code instances. Each forwarded tool call has a unique request ID, a 120-second timeout, and a response is accepted only from the same registered Agent connection that received the request.

The 40 bundled Agent tools are forwarded over this channel and executed by the extension's existing Agent dispatcher. The extension automatically reconnects with refreshed OneAuth credentials. Both the `/mcp` endpoint and legacy `/device` WebSocket remain enabled during rollout. The connection registry is process-local for this development phase; a multi-instance production deployment will need shared routing (for example Redis) before horizontal scaling.
