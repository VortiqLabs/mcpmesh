# MCP Mesh wildcard gateway

Each random hostname maps to an isolated session:

- MCP client: `https://<random>.mcp.nishantapps.in/mcp`
- Paired WebSocket peer: `wss://<same-random>.mcp.nishantapps.in/ws`

The peer connects over WebSocket and serves the MCP tools. The gateway forwards MCP `tools/list` and `tools/call` requests to that peer.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Forward port 8787. For the real wildcard domain, route `*.mcp.nishantapps.in` through a public reverse proxy/tunnel to this process and preserve the original Host header.

## Production build

The build bundles the gateway and its WebSocket library into one CommonJS file at `dist/index.cjs`. The resulting runtime has no npm dependencies.

```bash
npm ci
npm run build
npm prune --omit=dev
npm start
```

For Render, use the commands above as the **Build Command** and `npm start` as the **Start Command**. Do not set the build command to `npm ci --omit=dev` because the bundler and WebSocket library are build-time dependencies.

## WebSocket peer protocol

On connect, the gateway sends:

```json
{ "type": "mcp.connected", "session": "<slug>" }
```

For an MCP operation, the gateway sends:

```json
{ "type": "mcp.request", "id": "uuid", "method": "tools/list", "params": {} }
```

Reply using the same ID:

```json
{ "type": "mcp.result", "id": "uuid", "result": { "tools": [] } }
```

For `tools/call`, return the MCP CallToolResult in `result`. An error reply can use `"error": { "message": "reason" }`.

Only one peer can own a slug at a time. Set `WS_TOKEN` and connect with `/ws?token=<secret>` to require a shared secret. Put TLS at the public reverse proxy; do not expose the process directly without TLS and access control.
